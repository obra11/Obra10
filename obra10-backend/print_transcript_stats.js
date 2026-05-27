const fs = require('fs');
const readline = require('readline');

const logPath = 'C:\\Users\\User\\.gemini\\antigravity\\brain\\7243b401-6aee-4eda-8c50-158ffbf53c93\\.system_generated\\logs\\transcript.jsonl';

async function main() {
  const fileStream = fs.createReadStream(logPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  let lineCount = 0;
  const firstLines = [];
  for await (const line of rl) {
    lineCount++;
    if (lineCount <= 10) {
      firstLines.push(line);
    }
  }
  console.log("Total lines:", lineCount);
  console.log("First 10 lines:");
  firstLines.forEach((l, idx) => {
    try {
      const parsed = JSON.parse(l);
      console.log(`[${idx+1}] Source: ${parsed.source}, Type: ${parsed.type}`);
      if (parsed.content) console.log("   Content:", parsed.content.substring(0, 100));
    } catch(e) {
      console.log(`[${idx+1}] Raw:`, l.substring(0, 100));
    }
  });
}

main().catch(console.error);
