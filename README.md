# BK Mining — Umbrel Community App Store

Private Umbrel community app store hosting solo-mining stacks owned and
maintained outside of any third-party app.

## Apps

- **bk-solo-mining** — BCH solo mining: bitcoin-cash-node (BCHN) full node +
  ckpool + a Next.js dashboard with read-only stats and admin controls
  (change btcsig, restart pool, view logs).

## Why this exists

We previously used a third-party Umbrel community app for solo BCH mining,
but the dev's release cadence kept clobbering our local tunings. This store
takes ownership of the stack: same Docker images, our own docker-compose,
our own dashboard, our own update cadence.

## Installing on Umbrel

1. From the Umbrel UI, go to **Settings → Advanced Settings → App Stores**
2. Click **Add App Store**
3. Use the SSH clone URL (the deploy key is already registered on the Umbrel):
   ```
   git@github-bk-solo:bambryan/umbrel-bk-solo-mining.git
   ```
4. Browse to the new store and install **BK Solo Mining**.
