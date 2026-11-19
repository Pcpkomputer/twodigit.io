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
  status: "active" | "ended";
  createdAt: string;
  endedAt?: string;
  winner?: PollOption | null;
}

// In-memory poll store attached to globalThis to persist across Next.js dev reloads
interface GlobalPollStore {
  activePoll: PollState | null;
  votedUserIds: Map<string, number>; // userId -> optionIndex
}

const globalPoll = globalThis as unknown as {
  __pollStore?: GlobalPollStore;
};

if (!globalPoll.__pollStore) {
  globalPoll.__pollStore = {
    activePoll: null,
    votedUserIds: new Map(),
  };
}

const store = globalPoll.__pollStore;

// Recalculates percentages and returns updated poll
function recalculatePoll(poll: PollState): PollState {
  const total = poll.options.reduce((sum, opt) => sum + opt.votes, 0);
  poll.totalVotes = total;

  poll.options.forEach((opt) => {
    opt.percentage = total > 0 ? Number(((opt.votes / total) * 100).toFixed(1)) : 0;
  });

  return poll;
}

export function getActivePoll(): PollState | null {
  return store.activePoll;
}

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

  const newPoll: PollState = {
    id: `poll-${Date.now()}`,
    title: cleanTitle,
    options,
    totalVotes: 0,
    status: "active",
    createdAt: new Date().toISOString(),
  };

  store.activePoll = newPoll;
  store.votedUserIds.clear(); // Reset voter tracking for new poll

  // Broadcast poll creation to Pusher
  try {
    await pusherServer.trigger("donation-stream", "poll-update", newPoll);
  } catch (err) {
    console.error("Failed to broadcast poll creation to Pusher:", err);
  }

  return newPoll;
}

export async function registerVote(
  optionIndex: number,
  userId: string,
  nickname?: string
): Promise<{ success: boolean; message: string; poll?: PollState; duplicate?: boolean }> {
  const poll = store.activePoll;

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

  // Enforce 1 vote per unique TikTok user
  const cleanUserId = (userId || "").trim();
  if (cleanUserId) {
    if (store.votedUserIds.has(cleanUserId)) {
      return {
        success: false,
        message: `@${cleanUserId} sudah memberikan suara sebelumnya.`,
        duplicate: true,
      };
    }
    store.votedUserIds.set(cleanUserId, optionIndex);
  }

  // Increment vote count
  targetOption.votes += 1;
  const updatedPoll = recalculatePoll(poll);

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

export async function endPoll(): Promise<PollState | null> {
  const poll = store.activePoll;
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

  // Broadcast poll ended to Pusher
  try {
    await pusherServer.trigger("donation-stream", "poll-ended", poll);
  } catch (err) {
    console.error("Failed to broadcast poll end to Pusher:", err);
  }

  return poll;
}

export async function resetPoll(): Promise<void> {
  store.activePoll = null;
  store.votedUserIds.clear();

  try {
    await pusherServer.trigger("donation-stream", "poll-reset", {});
  } catch (err) {
    console.error("Failed to broadcast poll reset to Pusher:", err);
  }
}
