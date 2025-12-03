# WhatsApp Review Automation SaaS

A complete Node.js + Express application to automate Google Review collection via WhatsApp, triggered by Razorpay payments.

## Features

- **Razorpay Integration**: Automatically triggers a review request when a payment is captured.
- **WhatsApp Automation**: Uses 360dialog (Official WhatsApp Business API) to send template messages.
- **Smart Language Detection**: Heuristic detection (Hindi/English) based on customer name.
- **Review Logic**:
  - **4-5 Stars**: Prompts for a text/video review and attempts to post to Google (or logs it).
  - **<4 Stars**: Silently forwards feedback to the business owner.
- **Serverless Ready**: Configured for instant deployment on Vercel.

## Prerequisites

1.  **Razorpay Account**: Get your Key ID, Key Secret, and set up a Webhook Secret.
2.  **360dialog Account**: For WhatsApp Business API access. You need a verified Facebook Business Manager.
3.  **Google Cloud Project**: Enable "Google Business Profile API" and get OAuth2 credentials.
4.  **Vercel Account**: For deployment.

## Setup

1.  **Clone the repository** (if you haven't already).
2.  **Install dependencies**:
    ```bash
    npm install
    ```
3.  **Configure Environment Variables**:
    - Rename `env.example` to `.env`.
    - Fill in your API keys and secrets.

    ```bash
    cp env.example .env
    # Edit .env with your actual keys
    ```

## Local Development

To test webhooks locally, you need to expose your local server to the internet.

1.  **Start the server**:
    ```bash
    npm start
    ```
    Server runs on `http://localhost:3000`.

2.  **Start ngrok**:
    ```bash
    ngrok http 3000
    ```
    Copy the HTTPS URL (e.g., `https://your-ngrok-id.ngrok-free.app`).

3.  **Configure Webhooks**:
    - **Razorpay**: Go to Settings -> Webhooks -> Add New Webhook.
        - URL: `https://your-ngrok-id.ngrok-free.app/webhooks/razorpay`
        - Event: `payment.captured`
        - Secret: Same as in your `.env`.
    - **360dialog / WhatsApp**: Configure the callback URL.
        - URL: `https://your-ngrok-id.ngrok-free.app/webhooks/whatsapp`
        - Verify Token: Set a token in your `.env` (e.g., `my_secret_token`) and match it in the dashboard.

## Deployment (Vercel)

1.  Install Vercel CLI: `npm i -g vercel`
2.  Deploy:
    ```bash
    vercel
    ```
3.  Add Environment Variables in Vercel Dashboard (Settings -> Environment Variables).

## API Endpoints

-   `POST /webhooks/razorpay`: Endpoint for Razorpay payment events.
-   `GET /webhooks/whatsapp`: Verification endpoint for WhatsApp webhook.
-   `POST /webhooks/whatsapp`: Event handler for incoming WhatsApp messages.

## License

MIT
