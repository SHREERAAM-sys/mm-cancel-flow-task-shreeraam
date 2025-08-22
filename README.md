# Subscription Cancellation Flow

## Overview
This project implements a secure and structured **subscription cancellation flow** with **A/B testing**, **survey data collection**, and **retention offers**. It uses **Next.js/React** for the frontend and **Supabase (Postgres + RLS)** for the backend. The goal is to make cancellations transparent while learning why users leave and offering them fair alternatives.

---

## Architecture

### Frontend
- **React modal wizard** handles the cancellation journey with step-based routes (`question → steps → done`).  
- State is patched incrementally into local cancellation data and written on persist.  
- **A/B testing** determines whether the user sees a downsell offer.  
- Designed for mobile and desktop, responsive with step indicators.  

### Backend
Defined in `seed.sql`:
- **Tables**: `users`, `subscriptions`, `cancellations`  
- **Enums**: structured answers for applied/emailed/interview counts  
- **Views & RPCs**:  
  - `get_v_users` → safe list of users  
  - `fn_get_subscription_by_id` → subscription by user  
  - `fn_get_cancellations_by_user_id` → cancellations ordered by recency  
  - `fn_upsert_subscription` and `fn_upsert_cancellation` → validated inserts/updates  

All mutations go through RPC functions written in **PL/pgSQL** to enforce consistency and ownership checks.

---

## Security

1. **Row-Level Security (RLS)**  
   - Users only see their own data.  
   - Subscriptions: only updatable by the owner.  
   - Cancellations: only insertable/viewable by the owner.  

2. **PL/pgSQL Enforcement**  
   - Functions run with `SECURITY DEFINER` but check ownership inside.  
   - Example: `fn_upsert_subscription` rejects updates if the row belongs to another user.  

3. **Input Validation**  
   - Enums prevent invalid survey values.  
   - Type casting enforces booleans and integers.  
   - Functions reject inserts if required values like `monthly_price` are missing.  

4. **Safe Defaults**  
   - `created_at`/`updated_at` handled by DB.  
   - Always checks `auth.uid()` or explicit `p_user_id` to prevent unauthenticated writes.  

---

## A/B Testing

- **Variant A** → no downsell, direct survey.  
- **Variant B** → $10 discount offer before survey.  

Assignment is deterministic:  
- Saved in `localStorage` (`mm_downsell_variant:user@example.com`).  
- If no value exists, assigned randomly using **secure RNG** (`crypto.getRandomValues`).  
- Ensures both fairness (random assignment) and consistency (same user always gets same flow).

---

## UX Design Choices

- **Job Question First**: The first step asks if the user has found a job.  
  - **Yes path**: celebrates success, asks attribution (did MM help?), gathers visa details for follow-up.  
  - **No path**: attempts retention (discount offer in Variant B), asks usage counts, and captures cancellation reason.  

- **Visa Question in Yes Flow**:  
  Explicit **Yes/No** for company-provided lawyer:  
  - “Yes” → still captures visa type for analytics.  
  - “No” → creates a clear follow-up opportunity with MM’s partner lawyers.  
  This provides structured, actionable data rather than vague text.

- **Discount Persistence**:  
  Discounted price is **only saved if explicitly accepted**. Closing the modal or navigating back does not reduce the subscription amount. This avoids unintended billing changes.

---

## Why Use RPCs Instead of Direct Table Writes?
- **Centralized rules** in PL/pgSQL functions (not scattered across clients).  
- Ownership and validation checks happen automatically.  
- Easier to extend with logging, analytics, or triggers.  
- Prevents accidental or malicious misuse (e.g., updating another user’s subscription).

---

## Summary
This cancellation flow is designed to be:  
- **Secure** → with RLS, ownership enforcement, and validated inputs.  
- **Data-driven** → surveys capture structured reasons and visa needs.  
- **Experiment-ready** → A/B testing with secure randomization.  
- **User-respectful** → makes offers but never silently changes billing.  

It balances **business needs (retention, insights)** with **user trust and transparency**.  
