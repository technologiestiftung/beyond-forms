# Wallet Frontend Deployment Guide

This micro-frontend is deployed to Firebase Hosting.

## Prerequisites

- Firebase CLI installed (`npm install -g firebase-tools`)
- Logged into Firebase (`firebase login`)
- Access to the `beyond-forms-staging` project

## Deployment Steps

1.  **Configure Environment (Optional)**
    If you need to point the "Apply Now" button to a specific Auth/Wallet URL:
    Create a `.env.production` file:

    ```bash
    VITE_AUTH_URL=https://beyond-forms-hybrid-profile.web.app/auth
    ```

2.  **Build the Application**

    ```bash
    npm run build
    ```

3.  **Deploy to Firebase**

    ```bash
    # Create the site if it doesn't exist (first time only)
    firebase hosting:sites:create beyond-forms-frontend --project beyond-forms-staging

    # Deploy the site
    firebase deploy --only hosting:wallet-frontend
    ```

## URL

Once deployed, the application will be available at:
**https://beyond-forms-frontend.web.app**
