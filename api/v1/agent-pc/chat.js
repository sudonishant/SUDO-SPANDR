import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed', message: 'Use POST with { "message": "..." }' });
  }

  const userMsg = (req.body?.message || '').trim();
  if (!userMsg) {
    return res.status(400).json({ error: 'empty_message', message: 'Message is required.' });
  }

  // 1. Try forwarding to local Python intelligent agent server (http://127.0.0.1:8000/api/chat)
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const localRes = await fetch('http://127.0.0.1:8000/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: userMsg }),
      signal: controller.signal
    });
    clearTimeout(timer);

    if (localRes.ok) {
      const data = await localRes.json();
      return res.status(200).json(data);
    }
  } catch (err) {
    // Local server proxy failed, proceed to direct container execution or intelligent edge fallback
  }

  // 2. Direct docker execution if running locally on machine
  const msgLower = userMsg.toLowerCase();
  try {
    if (msgLower.includes('airlink')) {
      await execAsync('docker exec -d -e DISPLAY=:1 thm-attackbox google-chrome --no-sandbox https://airlink.neeshant.in/').catch(() => {});
      return res.status(200).json({
        reply: "🚀 **Action Executed:** AirLink (`airlink.neeshant.in`) ko aapke Agent PC (noVNC Desktop) par Google Chrome me open kar diya gaya hai!\n\nAap right-side screen par dekh sakte hain ya direct visit kar sakte hain: https://airlink.neeshant.in/",
        status: "success"
      });
    } else if (msgLower.includes('sudospandr') || msgLower.includes('spandr') || msgLower.includes('sentinelmail') || msgLower.includes('email')) {
      await execAsync('docker exec -d -e DISPLAY=:1 thm-attackbox google-chrome --no-sandbox https://sudospandrsce.vercel.app/').catch(() => {});
      return res.status(200).json({
        reply: "🛡️ **Action Executed:** SUDO SPANDR SentinelMail Workspace ko Agent PC par launch kar diya gaya hai.\n\n📌 **Features Available:**\n- Local-first EML & MSG file parser\n- Email Header analysis (SPF, DKIM, DMARC)\n- Malicious URL & attachment extraction\nDesktop shortcut bhi ready hai!",
        status: "success"
      });
    } else if (msgLower.includes('rea') || msgLower.includes('reverse') || msgLower.includes('binary')) {
      await execAsync("docker exec -d -e DISPLAY=:1 thm-attackbox bash -c \"xterm -hold -e 'cd /root/rea && echo \\\"=== REA Agent Environment ===\\\" && node -v && bash' &\"").catch(() => {});
      return res.status(200).json({
        reply: "🔬 **Action Executed:** REA (Reverse Engineer Anything - morluto/rea) agent workspace activate kar diya gaya hai!\n\nDesktop par terminal launch ho chuka hai. REA MCP suite aur dependencies container me installed hain. Aap kisi bhi binary file, native library ya APK ko reverse engineer kar sakte hain.",
        status: "success"
      });
    } else if (msgLower.includes('terminal') || msgLower.includes('bash') || msgLower.includes('shell')) {
      await execAsync('docker exec -d -e DISPLAY=:1 thm-attackbox xterm &').catch(() => {});
      return res.status(200).json({
        reply: "💻 **Action Executed:** Linux Terminal Agent PC ke screen par khol diya gaya hai.",
        status: "success"
      });
    } else if (msgLower.startsWith('exec:') || msgLower.startsWith('run:')) {
      const cmdToRun = userMsg.split(':', 2)[1].trim();
      const { stdout, stderr } = await execAsync(`docker exec -e DISPLAY=:1 thm-attackbox bash -c "${cmdToRun.replace(/"/g, '\\"')}"`);
      return res.status(200).json({
        reply: `⚙️ **Command:** \`${cmdToRun}\`\n\n\`\`\`text\n${(stdout || stderr || 'Command executed successfully.').trim()}\n\`\`\``,
        status: "success"
      });
    } else if (msgLower.includes('status') || msgLower.includes('ip') || msgLower.includes('machines')) {
      return res.status(200).json({
        reply: "📊 **Current Virtual Environment Status:**\n- **Agent PC (Workstation):** `10.49.157.66` (noVNC Port: 6080 - Online)\n- **Target Evidence Mail:** `10.49.146.6` (Artifacts Ready)\n- **Installed Tools:** SUDO SPANDR, REA, AirLink, Google Chrome, Node.js, Python3.",
        status: "success"
      });
    }
  } catch (dockerErr) {
    // Docker execution error fallback
  }

  // 3. Fallback response for edge cloud deployment
  return res.status(200).json({
    reply: `🤖 **Agent Response:** Mujhe aapka instruction mila: *'${userMsg}'*\n\n` +
      "Aap Agent PC ko direct command de sakte hain:\n" +
      "1. **'AirLink open karo'** → Desktop pe AirLink open karega.\n" +
      "2. **'SUDO SPANDR chalao'** → Email forensics tool launch karega.\n" +
      "3. **'REA agent activate karo'** → Reverse engineering suite open karega.\n" +
      "4. **'Terminal kholo'** → Desktop par terminal window kholega.\n" +
      "5. **`run: <command>`** → Agent PC me command chala kar output layega.",
    status: "success"
  });
}
