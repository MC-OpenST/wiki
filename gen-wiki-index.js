const fs = require('fs');
const path = require('path');

// --- 路径配置 ---
const WIKI_DIR = path.join(__dirname, 'wiki_content');
const OUTPUT_PATH = path.join(__dirname, 'public/wiki.json');
// 千禧年起点：用于生成唯一的递增 ID
const ARCHIVE_EPOCH = new Date('2000-01-01T00:00:00Z').getTime();

function scan() {
    if (!fs.existsSync(WIKI_DIR)) {
        console.error('❌ 错误: 未找到 wiki_content 目录');
        return;
    }

    const folders = fs.readdirSync(WIKI_DIR);

    const index = folders.map(folder => {
        const folderPath = path.join(WIKI_DIR, folder);

        // 排除非目录文件（如 .DS_Store）
        if (!fs.statSync(folderPath).isDirectory()) return null;

        const files = fs.readdirSync(folderPath);
        const mdName = files.find(f => f.endsWith('.md'));

        // 如果文件夹里没有 .md 文件，则跳过
        if (!mdName) return null;

        const filePath = path.join(folderPath, mdName);
        let raw = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);

        // --- 1. 元数据解析 (支持中英文冒号、中英文键名) ---
        let metaMatch = raw.match(/^===\s*([\s\S]*?)\s*===/);
        let meta = {};
        if (metaMatch) {
            metaMatch[1].split('\n').forEach(line => {
                const parts = line.split(/[:：]/);
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase(); // 统一转小写方便判断
                    const val = parts.slice(1).join(':').trim();
                    meta[key] = val;
                }
            });
        }

        // --- 2. ID 自动生成与固化 (核心逻辑) ---
        // 兼容键名：id, 文章id
        let finalId = meta['id'] || meta['文章id'];
        if (!finalId) {
            // 生成千禧秒数 ID (基于文件创建时间)
            const secondsSince2000 = Math.floor((stats.birthtimeMs - ARCHIVE_EPOCH) / 1000);
            finalId = `wiki-${secondsSince2000}`;

            // 自动写回文件：保持 YAML 格式并插入 ID
            if (metaMatch) {
                const newHeader = `===\nid: ${finalId}\n${metaMatch[1].trim()}\n===`;
                raw = raw.replace(/^===\s*([\s\S]*?)\s*===/, newHeader);
            } else {
                // 如果原本没有头部，则新建一个
                raw = `===\nid: ${finalId}\n标题: ${folder}\n简介: 暂无简介...\n标签: 无\n===\n\n${raw}`;
            }
            fs.writeFileSync(filePath, raw, 'utf-8');
            console.log(`✨ 为档案 [${folder}] 固化了新 ID: ${finalId}`);
        }

        // --- 3. 封面图智能探测 ---
        // 优先级：YAML定义 > 默认 images/cover.webp > 默认 images/logo.jpg > 占位图
        let coverPath = meta['封面'] || meta['cover'];
        if (!coverPath) {
            const possibleCovers = ['images/cover.webp', 'images/logo.jpg', 'logo.jpg', 'cover.png'];
            const found = possibleCovers.find(p => fs.existsSync(path.join(folderPath, p)));
            if (found) {
                coverPath = `wiki_content/${folder}/${found}`;
            } else {
                // 如果完全没找到封面，指向一个默认的资源（或者保持空让前端处理）
                coverPath = 'assets/default-logo.jpg';
            }
        } else {
            // 如果是 YAML 定义的相对路径，补全它
            if (!coverPath.startsWith('http')) {
                const cleanCover = coverPath.replace(/^\.\//, '');
                coverPath = `wiki_content/${folder}/${cleanCover}`;
            }
        }

        // --- 4. 组装索引对象 ---
        return {
            id: finalId,
            // 兼容中文键名
            title: meta['标题'] || meta['title'] || folder,
            summary: meta['简介'] || meta['summary'] || '档案馆未记录摘要...',
            tags: (meta['标签'] || meta['tags'] || '').split(/[，,]/).map(t => t.trim()).filter(Boolean),
            date: meta['创建日期'] || meta['date'] || stats.mtime.toISOString().split('T')[0],
            cover: coverPath,
            mdPath: `wiki_content/${folder}/${mdName}`,
            baseDir: `${folder}/`,
            // 搜索文本适配：去掉头部后的前 500 字
            searchText: raw.replace(/^===\s*[\s\S]*?\s*===\s*/, '').substring(0, 500).replace(/\s+/g, ' ')
        };
    }).filter(Boolean);

    // --- 5. 排序与输出 ---
    // 按 ID 降序（让新固化的文章排在前面）
    index.sort((a, b) => b.id.localeCompare(a.id));

    // 确保输出目录存在
    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), 'utf-8');
    console.log(`✅ 档案馆 5.0 索引同步完成: 共 ${index.length} 篇`);
}

// 执行扫描
scan();