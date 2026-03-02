const fs = require('fs');
const path = require('path');

// 路径配置
const WIKI_DIR = path.join(__dirname, 'wiki_content');
const OUTPUT_PATH = path.join(__dirname, 'public/wiki.json');
const ARCHIVE_EPOCH = new Date('2000-01-01T00:00:00Z').getTime();

function scan() {
    if (!fs.existsSync(WIKI_DIR)) {
        console.error('❌ 错误: 未找到 wiki_content 目录');
        return;
    }

    const folders = fs.readdirSync(WIKI_DIR);

    const index = folders.map(folder => {
        const folderPath = path.join(WIKI_DIR, folder);
        if (!fs.statSync(folderPath).isDirectory()) return null;

        const files = fs.readdirSync(folderPath);
        const mdName = files.find(f => f.endsWith('.md'));
        if (!mdName) return null;

        const filePath = path.join(folderPath, mdName);
        let raw = fs.readFileSync(filePath, 'utf-8');
        const stats = fs.statSync(filePath);

        // 1. 元数据解析
        let metaMatch = raw.match(/^===\s*([\s\S]*?)\s*===/);
        let meta = {};
        if (metaMatch) {
            metaMatch[1].split('\n').forEach(line => {
                const parts = line.split(/[:：]/);
                if (parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const val = parts.slice(1).join(':').trim();
                    meta[key] = val;
                }
            });
        }

        // 2. ID 自动生成与固化
        let finalId = meta['id'] || meta['文章id'];
        if (!finalId) {
            const secondsSince2000 = Math.floor((stats.birthtimeMs - ARCHIVE_EPOCH) / 1000);
            finalId = `wiki-${secondsSince2000}`;

            if (metaMatch) {
                const newHeader = `===\nid: ${finalId}\n${metaMatch[1].trim()}\n===`;
                raw = raw.replace(/^===\s*([\s\S]*?)\s*===/, newHeader);
            } else {
                raw = `===\nid: ${finalId}\n标题: ${folder}\n简介: 暂无简介...\n标签: 无\n===\n\n${raw}`;
            }
            fs.writeFileSync(filePath, raw, 'utf-8');
        }

        // 3. 置顶逻辑识别 (核心修改)
        // 支持键名：pinned, 置顶
        // 支持值：true, 是, yes, 1
        const pinnedVal = meta['pinned'] || meta['置顶'] || '';
        const isPinned = ['true', '是', 'yes', '1'].includes(pinnedVal.toLowerCase());

        // 4. 封面图探测
        let coverPath = meta['封面'] || meta['cover'];
        if (!coverPath) {
            const possibleCovers = ['images/cover.webp', 'images/logo.jpg', 'logo.jpg', 'cover.png'];
            const found = possibleCovers.find(p => fs.existsSync(path.join(folderPath, p)));
            coverPath = found ? `wiki_content/${folder}/${found}` : 'assets/default-logo.jpg';
        } else if (!coverPath.startsWith('http')) {
            coverPath = `wiki_content/${folder}/${coverPath.replace(/^\.\//, '')}`;
        }

        return {
            id: finalId,
            pinned: isPinned, // 💡 显式输出到 JSON 供前端排序
            title: meta['标题'] || meta['title'] || folder,
            summary: meta['简介'] || meta['summary'] || '档案馆未记录摘要...',
            tags: (meta['标签'] || meta['tags'] || '').split(/[，,]/).map(t => t.trim()).filter(Boolean),
            date: meta['创建日期'] || meta['date'] || stats.mtime.toISOString().split('T')[0],
            cover: coverPath,
            mdPath: `wiki_content/${folder}/${mdName}`,
            baseDir: `${folder}/`,
            searchText: raw.replace(/^===\s*[\s\S]*?\s*===\s*/, '').substring(0, 500).replace(/\s+/g, ' ')
        };
    }).filter(Boolean);

    // 5. 复合排序：置顶优先 + ID 降序
    index.sort((a, b) => {
        // 首先比对置顶状态
        if (a.pinned !== b.pinned) {
            return b.pinned ? 1 : -1;
        }
        // 同等状态下，按 ID 降序（新文章在前）
        return b.id.localeCompare(a.id);
    });

    const outputDir = path.dirname(OUTPUT_PATH);
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(index, null, 2), 'utf-8');

    console.log(`✅ 索引同步完成: 共 ${index.length} 篇 (含 ${index.filter(i=>i.pinned).length} 篇置顶)`);
}

scan();