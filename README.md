# 🚀 ZeroCut.io - MVP Edition

A production-ready, ultra-low latency, and zero-platform-fee donation overlay engine designed for self-hosted streamers. This Minimum Viable Product (MVP) replaces traditional third-party donation platforms (which charge 5-6% cuts) with an ultra-lightweight serverless architecture that routes 100% of non-MDR revenue directly to the creator's bank account.

---

## 💡 The "Why" behind this project

Many content creators boast about their massive digital presence but remain financially illiterate, blindly handing over 5% to 6% of their hard-earned viewer support to monolithic third-party platforms just because they lack the technical capability to build their own alert boxes. 

This repository was born out of pure logic defeating emotional outbursts. When challenged by the reality of their platform's leaking revenue, some individual chose cyber-tantrums (doxing and personal attacks) as a defense mechanism. As a high-tier software engineer, my response isn't anger—it's **engineering a superior alternative**. 

While others waste energy exposing faces, we expose architectural inefficiencies and solve them with code.

---

## 🛠️ Tech Stack & Architecture (MVP)

This MVP platform leverages a lightweight, event-driven architecture designed to keep operational costs at exactly **$0/month** with zero database overhead.

*   **Payment Gateway:** Midtrans Core/Snap API (Direct 0.7% standard QRIS interchange rate, no platform markup).
*   **Backend Services:** Node.js deployed on Vercel Serverless Functions.
*   **Real-time Layer:** Pusher Channels for sub-second alert delivery and real-time state synchronization.
*   **Frontend Overlay:** Vanilla HTML5 / Tailwind CSS / Web Speech API (Native browser-level Text-to-Speech and client-side leaderboard sorting).

---

## ✨ Features

*   **0% Platform Commission Fee:** Keep your revenue whole. Only pay the native payment gateway interchange rate.
*   **Idempotent Webhook Handler:** Prevents duplicate alert triggers from unstable internet retries.
*   **Asynchronous Audio/Visual Queue:** A robust JavaScript array-based queue system that ensures Text-to-Speech (TTS) messages play sequentially without overlapping or crashing the OBS Browser Source.
*   **Serverless Auto-scaling:** Zero cold-start latency optimization for high-concurrency streaming events.

---

## 🚀 Quick Start & Deployment

Want to stop being financially dependent and finally upgrade your tech stack? Follow these steps to host your own profile donation page:

### 1. Environment Variables Configuration
Create a `.env` file in your root directory (and add these to your Vercel Dashboard). Fill in the values with your own credentials:

```env
NEXT_PUBLIC_CREATOR_TITLE=""
NEXT_PUBLIC_CREATOR_DESCRIPTION=""

# Midtrans Credentials
MIDTRANS_MERCHANT_ID=""
NEXT_PUBLIC_MIDTRANS_CLIENT_KEY=""
MIDTRANS_SERVER_KEY=""
MIDTRANS_IS_PRODUCTION="false"

# Pusher Credentials
PUSHER_APP_ID=""
NEXT_PUBLIC_PUSHER_KEY=""
PUSHER_SECRET=""
NEXT_PUBLIC_PUSHER_CLUSTER="ap1"
```

### 2. Run Locally & Deploy to Vercel
```bash
# Install dependencies
npm install

# Deploy to Vercel instantly
npm install -g vercel
vercel deploy
```

---

## 📝 License
Distributed under the MIT License. Feel free to fork, clone, and use this to elevate your streaming career from an "instantly-triggered amateur" to a "technically-sovereign professional."
