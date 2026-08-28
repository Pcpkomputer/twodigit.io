# 🚀 Twodigit.io - MVP Edition

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

### 3. Setting Up Environment Variables in Vercel Dashboard
To securely inject your secrets into the production environment without committing them to git, add them directly inside the Vercel Dashboard:

1. Log in to your [Vercel Account](https://vercel.com) and select your project.
2. Navigate to the **Settings** tab at the top menu.
3. Click on **Environment Variables** in the left sidebar.
4. In the **Key** field, type the variable name (e.g., `MIDTRANS_SERVER_KEY`).
5. In the **Value** field, paste your corresponding credential token.
6. Under **Environments**, check the environments where this token applies (**Production**, **Preview**, and/or **Development**).
7. Click **Add** to save. Repeat this process for all credentials listed in the template above.
8. *Note:* If you update your variables after the first deployment, you must trigger a new deployment via the Vercel dashboard or CLI (`vercel --prod`) for the changes to take effect.


## 💳 Moving to Production & Webhook Configuration

To move away from the Midtrans Sandbox environment and start accepting real money from your viewers, you must switch your account status to **Production**, complete the mandatory compliance verification (KYC), and wire up the notification webhook.

### 📋 Checklist & Required Documents (Individual / UMKM Tier)
If you register as an individual creator or micro-business, prepare the following documents:
1.  **KTP (Identity Card):** A clear, non-glare photo of your Indonesian National ID.
2.  **Selfie with KTP:** Ensure your face and the KTP data are clearly visible.
3.  **NPWP (Tax ID Number):** Optional for some initial transaction tiers, but highly recommended for continuous smooth payouts and professional compliance.
4.  **Personal Bank Account:** The account name **must match exactly** with the name on your KTP. This is where your cleared funds will be automatically disbursed.

### 🔗 Configuring Midtrans Notification Webhook
For the real-time alert overlay and leaderboard to work, Midtrans needs to know where to send payment status updates. You must configure this in both your **Sandbox** and **Production** dashboards:

1.  Deploy your project to Vercel first to get your live deployment URL (e.g., `https://vercel.app`).
2.  Log in to your Midtrans Dashboard.
3.  Go to **Settings** ➡️ **Configuration**.
4.  Locate the **Payment Notification URL** field and change it to your Vercel API webhook endpoint:
    ```text
    https://vercel.app/api/webhook/midtrans
    ```
5.  *(Optional)* Set the **Redirection URL** fields (Finish, Unfinished, Error URL) if you want to redirect the supporters back to your custom streaming profile page after they finish paying.
6.  Click **Update** at the bottom of the page to save the configurations.

### 🔄 Activation Steps:
1.  Toggle the switch from **Sandbox** to **Production** mode on the top left corner of the Midtrans Dashboard.
2.  Click **"Passport / Registration"** and fill out your business profile information truthfully (Select "Perorangan / Individual" tier).
3.  Upload your KYC documents (KTP and Selfie).
4.  Activate your preferred payment methods (Make sure to check **QRIS** and **E-Wallets** for streaming donation optimization).
5.  Wait for the Midtrans team to review your application (Usually takes 1-3 business days).
6.  Once approved, update your `.env` keys in your production server with the new production credentials, and flip `MIDTRANS_IS_PRODUCTION` to `"true"`.

---

## 📝 License
Distributed under the MIT License. Feel free to fork, clone, and use this to elevate your streaming career from an "instantly-triggered amateur" to a "technically-sovereign professional."
