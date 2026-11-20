import { supabaseAdmin } from "@/lib/supabase";
import { pusherServer } from "@/lib/pusher";

export interface PollOption {
  index: number; // 1, 2, 3, etc.
  label: string;
  votes: number;
  percentage: number;
}

export interface PollState {
  id: string;
  title: string;
  options: PollOption[];
  totalVotes: number;
  status: "active" | "ended" | "archived";
  createdAt: string;
  endedAt?: string;
  winner?: PollOption | null;
}

// Recalculates percentages and returns updated poll
function recalculatePoll(poll: PollState): PollState {
  const total = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  poll.totalVotes = total;

  poll.options.forEach((opt) => {
    opt.percentage = total > 0 ? Number(((opt.votes / total) * 100).toFixed(1)) : 0;
  });

  return poll;
}

/**
 * Retrieves the currently active poll from Supabase database
 */
export async function getActivePoll(): Promise<PollState | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from("polls")
      .select("*")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch active poll from Supabase:", error);
      return null;
    }

    if (!data) return null;

    return {
      id: data.id,
      title: data.title,
      options: data.options as PollOption[],
      totalVotes: data.total_votes,
      status: data.status,
      createdAt: data.created_at,
      endedAt: data.ended_at,
      winner: data.winner,
    };
  } catch (err) {
    console.error("getActivePoll error:", err);
    return null;
  }
}

/**
 * Creates a new poll session in Supabase and archives any prior active session
 */
export async function createPoll(title: string, optionLabels: string[]): Promise<PollState> {
  const cleanTitle = title.trim() || "Voting Live";
  const cleanOptions = optionLabels
    .map((lbl) => lbl.trim())
    .filter(Boolean);

  if (cleanOptions.length < 2) {
    throw new Error("Voting membutuhkan minimal 2 opsi pilihan.");
  }

  const options: PollOption[] = cleanOptions.map((label, idx) => ({
    index: idx + 1,
    label,
    votes: 0,
    percentage: 0,
  }));

  const pollId = `poll-${Date.now()}`;
  const nowIso = new Date().toISOString();

  const newPoll: PollState = {
    id: pollId,
    title: cleanTitle,
    options,
    totalVotes: 0,
    status: "active",
    createdAt: nowIso,
  };

  // 1. Archive any existing active poll
  const { error: archiveError } = await supabaseAdmin
    .from("polls")
    .update({ status: "archived" })
    .eq("status", "active");

  if (archiveError) {
    console.warn("Failed to archive prior polls:", archiveError);
  }

  // 2. Insert new poll session into Supabase
  const { error: insertError } = await supabaseAdmin.from("polls").insert({
    id: newPoll.id,
    title: newPoll.title,
    options: newPoll.options,
    total_votes: newPoll.totalVotes,
    status: "active",
    created_at: newPoll.createdAt,
  });

  if (insertError) {
    console.error("Failed to insert new poll to Supabase:", insertError);
    throw new Error(`Gagal menyimpan voting ke database: ${insertError.message}`);
  }

  // 3. Broadcast poll creation to Pusher
  try {
    await pusherServer.trigger("donation-stream", "poll-update", newPoll);
  } catch (err) {
    console.error("Failed to broadcast poll creation to Pusher:", err);
  }

  return newPoll;
}

/**
 * Registers a vote in Supabase with atomic duplicate prevention per TikTok user
 */
export async function registerVote(
  optionIndex: number,
  userId: string,
  nickname?: string
): Promise<{ success: boolean; message: string; poll?: PollState; duplicate?: boolean }> {
  const poll = await getActivePoll();

  if (!poll || poll.status !== "active") {
    return { success: false, message: "Tidak ada voting yang sedang aktif." };
  }

  // Validate option index (1-based)
  const targetOption = poll.options.find((opt) => opt.index === optionIndex);
  if (!targetOption) {
    return {
      success: false,
      message: `Pilihan ${optionIndex} tidak valid. Opsi yang tersedia: 1 sampai ${poll.options.length}`,
    };
  }

  const cleanUserId = (userId || "").trim();

  // Enforce 1 vote per unique user using database UNIQUE constraint
  if (cleanUserId) {
    const { error: voteInsertError } = await supabaseAdmin.from("poll_votes").insert({
      poll_id: poll.id,
      user_id: cleanUserId,
      option_index: optionIndex,
      nickname: nickname || null,
      created_at: new Date().toISOString(),
    });

    if (voteInsertError) {
      // Postgres error code 23505 = unique_violation
      if (voteInsertError.code === "23505" || voteInsertError.message?.toLowerCase().includes("unique")) {
        return {
          success: false,
          message: `@${cleanUserId} sudah memberikan suara sebelumnya.`,
          duplicate: true,
        };
      }

      console.error("Failed to insert vote into poll_votes:", voteInsertError);
      return {
        success: false,
        message: "Gagal mencatat suara ke database.",
      };
    }
  }

  // Increment vote count for the chosen option
  targetOption.votes += 1;
  const updatedPoll = recalculatePoll(poll);

  // Update tallies in Supabase
  const { error: updateError } = await supabaseAdmin
    .from("polls")
    .update({
      options: updatedPoll.options,
      total_votes: updatedPoll.totalVotes,
    })
    .eq("id", poll.id);

  if (updateError) {
    console.error("Failed to update poll tallies in Supabase:", updateError);
  }

  // Broadcast updated vote tallies to Pusher in real-time
  try {
    await pusherServer.trigger("donation-stream", "poll-update", updatedPoll);
  } catch (err) {
    console.error("Failed to broadcast vote update to Pusher:", err);
  }

  return {
    success: true,
    message: `Suara berhasil dicatat untuk [${targetOption.index}] ${targetOption.label}`,
    poll: updatedPoll,
  };
}

/**
 * Concludes the active poll, determines winner, and saves to database
 */
export async function endPoll(): Promise<PollState | null> {
  const poll = await getActivePoll();
  if (!poll) return null;

  poll.status = "ended";
  poll.endedAt = new Date().toISOString();

  // Determine winner(s)
  if (poll.totalVotes > 0) {
    const sorted = [...poll.options].sort((a, b) => b.votes - a.votes);
    poll.winner = sorted[0];
  } else {
    poll.winner = null;
  }

  // Update in Supabase
  const { error: updateError } = await supabaseAdmin
    .from("polls")
    .update({
      status: "ended",
      ended_at: poll.endedAt,
      winner: poll.winner,
    })
    .eq("id", poll.id);

  if (updateError) {
    console.error("Failed to mark poll as ended in Supabase:", updateError);
  }

  // Broadcast poll ended event to Pusher
  try {
    await pusherServer.trigger("donation-stream", "poll-update", poll);
  } catch (err) {
    console.error("Failed to broadcast poll end to Pusher:", err);
  }

  return poll;
}

/**
 * Resets/archives the current poll session
 */
export async function resetPoll(): Promise<void> {
  const { error } = await supabaseAdmin
    .from("polls")
    .update({ status: "archived" })
    .eq("status", "active");

  if (error) {
    console.error("Failed to reset poll in Supabase:", error);
  }

  // Broadcast reset event to Pusher to close overlay widget
  try {
    await pusherServer.trigger("donation-stream", "poll-update", {
      status: "ended",
      action: "reset",
    });
  } catch (err) {
    console.error("Failed to broadcast poll reset to Pusher:", err);
  }
}
