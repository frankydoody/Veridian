import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

export const transcribeAudio = async (audioPath) => {
  const outputDir = path.dirname(audioPath);
  const model = process.env.WHISPER_MODEL || 'small';
  const language = process.env.WHISPER_LANGUAGE || 'fr';

  const command = `whisper "${audioPath}" --model ${model} --language ${language} --output_format json --output_dir "${outputDir}"`;

  await execAsync(command);

  const baseName = path.basename(audioPath, path.extname(audioPath));
  const jsonPath = path.join(outputDir, `${baseName}.json`);
  const result = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

  fs.unlinkSync(jsonPath);

  return result.text.trim();
};