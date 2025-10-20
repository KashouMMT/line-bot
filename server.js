import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import crypto from 'crypto';

const app = express();

// ✅ Capture raw body for signature verification
app.use(
    express.json({
        verify: (req, res, buf) => {
            req.rawBody = buf.toString(); // ensure it's a string, not undefined
        },
    })
);

const SECRET = process.env.LINE_CHANNEL_SECRET;
const TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

function okSig(req) {
    const sig = req.headers['x-line-signature'];
    const body = req.rawBody || ''; // fallback to empty string
    const hash = crypto.createHmac('sha256', SECRET).update(body).digest('base64');
    return sig === hash;
}

app.post('/webhook', async (req, res) => {
    if (!okSig(req)) {
        console.log('❌ Invalid signature');
        return res.sendStatus(403);
    }

    const events = req.body.events || [];
    const REPLY_API = 'https://api.line.me/v2/bot/message/reply';

    await Promise.all(events.map(async (ev) => {
        if (!ev.replyToken) return; // skip if no reply token

        // Handle text message
        if (ev.type === 'message' && ev.message?.type === 'text') {
            const t = (ev.message.text || '').trim().toLowerCase();

            // When user sends “Shop Now” or “ดูสินค้า”
            if (t === 'Shop Now' || t === 'ดูสินค้า') {
                const messages = [
                    { type: 'text', text: 'link: A' },
                    { type: 'text', text: 'link: B' },
                    { type: 'text', text: 'link: C' },
                ];
                await axios.post(REPLY_API, { replyToken: ev.replyToken, messages }, {
                    headers: { Authorization: `Bearer ${TOKEN}` },
                });
                return;
            }
        }

        // Handle postback (for API-created rich menu)
        if (ev.type === 'postback' && ev.postback?.data === 'action=shop_select') {
            const messages = [
                { type: 'text', text: 'link: A' },
                { type: 'text', text: 'link: B' },
                { type: 'text', text: 'link: C' },
            ];
            await axios.post(REPLY_API, { replyToken: ev.replyToken, messages }, {
                headers: { Authorization: `Bearer ${TOKEN}` },
            });
            return;
        }
    }));

    res.sendStatus(200);
});


app.get('/', (_req, res) => res.send('OK'));
app.listen(process.env.PORT || 3000, () => console.log('✅ LINE bot running on port 3000'));
