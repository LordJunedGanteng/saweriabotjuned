// bot.js
// Discord bot untuk baca message dari Saweria webhook dan kirim ke Vercel API

const { Client, GatewayIntentBits } = require('discord.js');

// ============================================
// CONFIG
// ============================================
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID; // Channel dimana webhook Saweria kirim
const VERCEL_API_URL = process.env.VERCEL_API_URL || 'https://saweriajuned2.vercel.app/api/webhook';

// ============================================
// CREATE DISCORD CLIENT
// ============================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ============================================
// BOT READY
// ============================================
client.once('ready', () => {
  console.log('✅ Discord Bot Online!');
  console.log(`🤖 Logged in as ${client.user.tag}`);
  console.log(`📡 Listening to channel: ${CHANNEL_ID}`);
  console.log(`🔗 Forwarding to: ${VERCEL_API_URL}`);
});

// ============================================
// PARSE SAWERIA MESSAGE
// ============================================
function parseSaweriaMessage(message) {
  // Saweria biasanya kirim format:
  // "💰 [Donor Name] donated Rp XXX"
  // atau embed dengan fields
  
  let donor = 'Anonymous';
  let amount = 0;
  let donationMessage = '';
  
  // Parse dari embed (kalau ada)
  if (message.embeds && message.embeds.length > 0) {
    const embed = message.embeds[0];
    
    // Cari fields
    if (embed.fields) {
      embed.fields.forEach(field => {
        const name = field.name.toLowerCase();
        const value = field.value;
        
        if (name.includes('donor') || name.includes('nama')) {
          donor = value;
        } else if (name.includes('amount') || name.includes('jumlah')) {
          // Extract angka dari "Rp 50.000" atau "$50"
          const numbers = value.match(/[\d.,]+/g);
          if (numbers) {
            amount = parseInt(numbers.join('').replace(/[.,]/g, ''));
          }
        } else if (name.includes('message') || name.includes('pesan')) {
          donationMessage = value;
        }
      });
    }
    
    // Fallback: parse dari title atau description
    if (embed.title) {
      const titleMatch = embed.title.match(/(.+?)\s+donated\s+Rp\s*([\d.,]+)/i);
      if (titleMatch) {
        donor = titleMatch[1];
        amount = parseInt(titleMatch[2].replace(/[.,]/g, ''));
      }
    }
  }
  
  // Parse dari content text (fallback)
  if (message.content) {
    const contentMatch = message.content.match(/💰\s+(.+?)\s+donated\s+Rp\s*([\d.,]+)/i);
    if (contentMatch) {
      donor = contentMatch[1];
      amount = parseInt(contentMatch[2].replace(/[.,]/g, ''));
    }
  }
  
  return {
    donor,
    amount,
    message: donationMessage,
    timestamp: message.createdAt.toISOString(),
    id: message.id
  };
}

// ============================================
// FORWARD TO VERCEL API
// ============================================
async function forwardToVercel(donationData) {
  try {
    const response = await fetch(VERCEL_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Source': 'discord-bot'
      },
      body: JSON.stringify({
        donator_name: donationData.donor,
        amount_raw: donationData.amount,
        amount: donationData.amount,
        message: donationData.message,
        created_at: donationData.timestamp,
        id: donationData.id,
        source: 'discord'
      })
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('✅ Forwarded to Vercel:', result);
      return true;
    } else {
      const error = await response.text();
      console.error('❌ Vercel API Error:', error);
      return false;
    }
  } catch (error) {
    console.error('❌ Forward Error:', error);
    return false;
  }
}

// ============================================
// MESSAGE LISTENER
// ============================================
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot && message.author.id === client.user.id) return;
  
  // Check if message is in target channel
  if (message.channel.id !== CHANNEL_ID) return;
  
  // Check if message is from webhook (Saweria)
  if (!message.webhookId) return;
  
  console.log('📨 New donation message detected!');
  
  // Parse donation data
  const donationData = parseSaweriaMessage(message);
  
  console.log('💰 Parsed donation:', donationData);
  
  // Forward to Vercel
  if (donationData.amount > 0) {
    const success = await forwardToVercel(donationData);
    
    if (success) {
      console.log('✅ Successfully processed donation from', donationData.donor);
      
      // Optional: React to message
      try {
        await message.react('✅');
      } catch (err) {
        // Ignore reaction errors
      }
    }
  } else {
    console.warn('⚠️ Could not parse amount from message');
  }
});

// ============================================
// ERROR HANDLING
// ============================================
client.on('error', (error) => {
  console.error('❌ Discord Client Error:', error);
});

process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled Rejection:', error);
});

// ============================================
// START BOT
// ============================================
if (!DISCORD_BOT_TOKEN) {
  console.error('❌ DISCORD_BOT_TOKEN is required!');
  process.exit(1);
}

if (!CHANNEL_ID) {
  console.error('❌ DISCORD_CHANNEL_ID is required!');
  process.exit(1);
}

client.login(DISCORD_BOT_TOKEN).catch((error) => {
  console.error('❌ Failed to login:', error);
  process.exit(1);
});

// Keep alive for hosting services (Replit, Railway, etc)
const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.json({
    status: 'online',
    bot: client.user?.tag || 'Not ready',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  });
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.listen(PORT, () => {
  console.log(`🌐 Keep-alive server running on port ${PORT}`);
  console.log(`📍 URL for UptimeRobot: http://your-host:${PORT}/ping`);
});
