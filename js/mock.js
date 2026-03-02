(function() {
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
        const response = await originalFetch(...args);

        // 💡 匹配你的配置文件名 (wiki.json)
        if (args[0] && args[0].includes('wiki.json')) {
            const realData = await response.json();
            console.warn("🚀 Wiki-Mock 系统已启动：拦截数据并注入 52 篇极端案例...");

            const mockData = [...realData]; // 先保留原有的真实数据

            for (let i = 1; i <= 52; i++) {
                const baseItem = realData[i % realData.length] || {
                    id: "base", title: "默认", summary: "缺失数据",
                    tags: [], mdPath: "", baseDir: ""
                };

                // 构造各种“逼疯”UI 的极端情况
                let testTitle = `存档测试 #${i}`;
                let testTags = ["基础"];
                let isPinned = i % 10 === 0; // 每 10 篇出一个置顶，测试跨页置顶逻辑

                if (i % 4 === 1) {
                    testTitle = `[长标题] ${"这条标题超级长".repeat(5)} #${i}`;
                    testTags = ["高版本", "生存", "红石", "SIS", "堆叠", "高效率", "模块化"];
                } else if (i % 4 === 2) {
                    testTitle = `短 #${i}`;
                    testTags = ["超级超级超级超级超级长的单标签测试"];
                } else {
                    testTags = Array(i % 5 + 1).fill(0).map((_, idx) => `Tag-${idx}`);
                }

                mockData.push({
                    ...baseItem,
                    id: `mock-id-${i}`,
                    title: testTitle,
                    summary: `这是拦截 Fetch 后生成的第 ${i} 条模拟内容，用于检查瀑布流是否会因为标题过长而导致卡片高度不一。`,
                    tags: testTags,
                    pinned: isPinned,
                    // 模拟图片：使用随机 seed 确保每张图不一样
                    cover: i % 3 === 0 ? `https://picsum.photos/seed/wiki-${i}/800/450` : null
                });
            }

            // 返回一个新的 Response 对象，Vue 拿到的就是这个“加料”后的数据
            return new Response(JSON.stringify(mockData), {
                headers: { 'Content-Type': 'application/json' }
            });
        }
        return response;
    };
})();