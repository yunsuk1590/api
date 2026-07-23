import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateEnv } from '../config.js';
import { recognizeFridgeImage, generateRecipes } from './openrouter.js';

let envError = null;
try {
  validateEnv();
} catch (err) {
  envError = err;
  console.error(err.message);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3000;

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10MB, per PRD 01 FR-1

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error('jpg 또는 png 이미지만 업로드할 수 있습니다.'));
    }
    cb(null, true);
  },
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.post('/api/inventory/recognize', (req, res) => {
  if (envError) {
    return res.status(500).json({ error: `서버 설정 오류: ${envError.message}` });
  }

  upload.single('image')(req, res, async (uploadErr) => {
    if (uploadErr) {
      return res.status(400).json({ error: uploadErr.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'image 필드로 파일을 업로드해주세요.' });
    }

    const imageDataUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;

    try {
      const result = await recognizeFridgeImage(imageDataUrl);
      res.json(result);
    } catch (err) {
      res.status(502).json({ error: `이미지 인식에 실패했습니다: ${err.message}` });
    }
  });
});

app.post('/api/recipes/generate', async (req, res) => {
  if (envError) {
    return res.status(500).json({ error: `서버 설정 오류: ${envError.message}` });
  }

  const { items, preferences } = req.body || {};

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items 배열(최소 1개)이 필요합니다.' });
  }

  try {
    const result = await generateRecipes(items, preferences);
    res.json(result);
  } catch (err) {
    res.status(502).json({ error: `레시피 생성에 실패했습니다: ${err.message}` });
  }
});

if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
  });
}

export default app;
