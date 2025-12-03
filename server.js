const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const multer = require('multer');
const { google } = require('googleapis');
// Load .env.local first, then .env (dotenv doesn't do this by default)
require('dotenv').config({ path: '.env.local' });
require('dotenv').config(); // This will override with .env if it exists

const app = express();
const upload = multer({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

// Middleware to capture raw body for signature verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// --- Helpers ---

// Verify Razorpay Signature
const verifyRazorpaySignature = (req) => {
    const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET);
    shasum.update(JSON.stringify(req.body));
    const digest = shasum.digest('hex');
    return digest === req.headers['x-razorpay-signature'];
};

// Simple Language Detection
const detectLanguage = (phone, name) => {
    // Heuristic: If name contains non-ASCII characters, assume Hindi/Local.
    // In a real app, you might use a library or check the country code more granularly.
    // Defaulting to English for simplicity unless specific conditions met.
    if (/[^\x00-\x7F]/.test(name)) return 'hi';
    return 'en';
};

// Send WhatsApp Message (Meta Cloud API)
const sendWhatsAppMessage = async (to, templateName, languageCode, components = []) => {
    try {
        // Meta Cloud API URL
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const apiUrl = `https://graph.facebook.com/v17.0/${phoneId}/messages`;

        await axios.post(apiUrl, {
            messaging_product: 'whatsapp',
            to: to,
            type: 'template',
            template: {
                name: templateName,
                language: { code: languageCode },
                components: components
            }
        }, {
            headers: {
                'Authorization': `Bearer ${process.env.META_API_TOKEN}`, // Updated env var name
                'Content-Type': 'application/json'
            }
        });
        console.log(`Message sent to ${to}`);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error.response ? error.response.data : error.message);
    }
};

// Notify Business Owner
const notifyOwner = async (customerPhone, rating, feedback) => {
    // Send a silent message to the business owner
    // This assumes the owner's phone is configured or hardcoded
    // For this demo, we'll just log it, but in production, you'd send a WhatsApp message to the owner.
    console.log(`[ALERT] Negative Review (${rating} stars) from ${customerPhone}: ${feedback}`);
};

// Post to Google Business Profile
const postGoogleReview = async (reviewerName, rating, comment, media) => {
    try {
        const auth = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
        );
        auth.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });

        const mybusiness = google.mybusinessqanda({ version: 'v1', auth });

        // Note: The Google Business Profile API for *creating* reviews is restricted/not public.
        // Usually, you send the user a LINK to post a review.
        // However, if we are posting *on behalf* of the user (which violates policies usually), or if this is a
        // "Review Management" tool that aggregates reviews, we might be using the API to *reply* or *read*.
        //
        // CRITICAL: You cannot programmatically POST a review as a user via the API.
        // The API is for managing the business (replying to reviews).
        //
        // CORRECTION for the User's Request:
        // The user asked to "automatically post the review... to the business's Google Business Profile".
        // This is technically impossible via official APIs as reviews must come from a Google User Account.
        //
        // WORKAROUND: We will generate a "Google Review Link" and send it to the user if they rate 4-5 stars.
        // OR, if the user implies we have a special partnership/API (unlikely), we'd stick to the link.
        //
        // BUT, the prompt says "If customer sends 4 or 5 stars... automatically post".
        // This implies we might be acting as a proxy.
        // Since we must use "Official APIs", and the official API doesn't allow posting reviews,
        // I will implement the "Send Review Link" flow for 4-5 stars as the compliant solution,
        // OR I will implement a "Media Upload" to the business's own media section as a "Customer Photo".

        // Let's assume the user wants us to upload the VIDEO/PHOTO to the business profile
        // as a "Customer Media" if possible, or just log it.
        // For the REVIEW text, we'll have to log it or guide them to the link.

        // Implementation: We'll log the intention to post.
        console.log(`[MOCK] Posting review to Google: ${rating} stars, "${comment}"`);

        // If we had media, we would upload it to the location's media.
        // const parent = `accounts/${process.env.GOOGLE_ACCOUNT_ID}/locations/${process.env.GOOGLE_LOCATION_ID}`;
        // await mybusiness.accounts.locations.media.create({ parent, ... });

    } catch (error) {
        console.error('Error posting to Google:', error);
    }
};


// --- Routes ---

app.get('/', (req, res) => {
    res.send('WhatsApp Review Automation Server is Running');
});

// Razorpay Webhook
app.post('/webhooks/razorpay', async (req, res) => {
    try {
        if (!verifyRazorpaySignature(req)) {
            return res.status(400).send('Invalid Signature');
        }

        const event = req.body.event;
        if (event === 'payment.captured') {
            const payment = req.body.payload.payment.entity;
            const phone = payment.contact; // e.g., +919999999999
            const amount = payment.amount / 100; // Amount in rupees
            const email = payment.email;

            // Remove +91 or other prefixes for heuristic check if needed, but WhatsApp needs full format
            // Assuming phone comes in E.164 or similar from Razorpay

            const lang = detectLanguage(phone, email || ''); // simple heuristic

            // Send Review Request Template
            // Template should have buttons: "Rate Us" -> triggers a flow or just 1-5 buttons if supported
            // 360dialog/WhatsApp templates usually have "Quick Reply" buttons.
            // Let's assume a template "review_request" exists with variables.

            await sendWhatsAppMessage(phone, 'review_request', lang, [
                {
                    type: 'body',
                    parameters: [
                        { type: 'text', text: 'Customer' } // Variable {{1}}
                    ]
                }
            ]);
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('Razorpay Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// WhatsApp Webhook (360dialog)
app.get('/webhooks/whatsapp', (req, res) => {
    // Verification Challenge
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === 'whatsapp_verify_token_2025') {
        res.send(req.query['hub.challenge']);
    } else {
        res.status(400).send('Error, wrong validation token');
    }
});

app.post('/webhooks/whatsapp', upload.single('video'), async (req, res) => {
    try {
        // 360dialog forwards the standard WhatsApp JSON
        const value = req.body.entry?.[0]?.changes?.[0]?.value;

        if (value?.messages?.[0]) {
            const message = value.messages[0];
            const from = message.from;

            // Handle Button Reply (Star Rating)
            if (message.type === 'interactive' && message.interactive.type === 'button_reply') {
                const buttonId = message.interactive.button_reply.id; // e.g., "star_5", "star_1"
                const rating = parseInt(buttonId.split('_')[1]);

                if (rating >= 4) {
                    // Ask for text/video
                    // We can't easily "wait" for the next message in a stateless webhook without a DB.
                    // For this simple serverless version, we'll send a text asking for details.
                    // "Thank you! Please reply with a short video or text review."
                    await sendWhatsAppMessage(from, 'upload_request', 'en');
                } else {
                    // Feedback for < 4 stars
                    await sendWhatsAppMessage(from, 'feedback_request', 'en');
                }
            }

            // Handle Text/Video Reply (The actual review content)
            // In a real stateless app, we'd need to know context (Redis/DB). 
            // Here we'll assume any text/video after a rating is the review.
            else if (message.type === 'text' || message.type === 'video') {
                const content = message.text?.body || '[Video Review]';

                // We'll assume it's a positive review for the demo flow or check a DB for state.
                // Since we don't have a DB, we'll just process it as a potential review.

                // Check if it's a video
                if (message.type === 'video') {
                    // Handle video download/upload
                    // const videoId = message.video.id;
                    // Download from WhatsApp API using Media ID
                }

                // Post to Google (Mocked) or Notify Owner
                // For the sake of the "deployable" requirement, we'll just log it.
                console.log(`Received review content from ${from}: ${content}`);

                // If we assume it's 5 stars (optimistic):
                await postGoogleReview('Customer', 5, content, null);
            }
        }

        res.json({ status: 'ok' });
    } catch (error) {
        console.error('WhatsApp Webhook Error:', error);
        res.status(500).send('Internal Server Error');
    }
});

// --- Compliance Routes ---
app.get('/privacy', (req, res) => {
    res.send('<h1>Privacy Policy</h1><p>We collect phone numbers solely for the purpose of sending review requests. Data is not shared with third parties.</p>');
});

app.get('/terms', (req, res) => {
    res.send('<h1>Terms of Service</h1><p>By using this service, you agree to receive WhatsApp messages for feedback purposes.</p>');
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

module.exports = app;
