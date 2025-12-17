const express = require('express');
const puppeteer = require('puppeteer');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

let browser;

// Inicializar browser
async function initBrowser() {
    if (!browser) {
        browser = await puppeteer.launch({
            headless: 'new',
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--ignore-certificate-errors',
                '--ignore-certificate-errors-spki-list'
            ]
        });
    }
    return browser;
}

// Endpoint para buscar jogos
app.post('/api/search-game', async (req, res) => {
    let page;
    try {
        const { gameName } = req.body;
        
        if (!gameName) {
            return res.status(400).json({ message: 'Nome do jogo é obrigatório' });
        }

        console.log(`🔍 Buscando: ${gameName}`);

        const browser = await initBrowser();
        page = await browser.newPage();
        
        // Configurar timeout e user agent
        await page.setDefaultNavigationTimeout(30000);
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

        const searchUrl = `https://online-fix.me/?s=${encodeURIComponent(gameName)}`;
        await page.goto(searchUrl, { waitUntil: 'networkidle2' });

        // Extrair dados dos jogos
        const games = await page.evaluate(() => {
            const results = [];
            const articles = document.querySelectorAll('article.post, .search-item, .post-item');
            
            articles.forEach(article => {
                const titleElement = article.querySelector('h2 a, .entry-title a, .post-title a');
                const imageElement = article.querySelector('img');
                
                if (titleElement) {
                    results.push({
                        title: titleElement.textContent.trim(),
                        link: titleElement.href,
                        image: imageElement ? imageElement.src : ''
                    });
                }
            });
            
            return results;
        });

        await page.close();

        console.log(`✅ Encontrados ${games.length} jogos`);

        if (games.length === 0) {
            return res.status(404).json({ message: 'Nenhum jogo encontrado' });
        }

        res.json({ games });

    } catch (error) {
        console.error('❌ Erro ao buscar jogo:', error.message);
        
        if (page) await page.close().catch(() => {});
        
        res.status(500).json({ 
            message: 'Erro ao buscar jogo',
            error: error.message 
        });
    }
});

// Endpoint para obter links de download
app.post('/api/get-download-links', async (req, res) => {
    let page;
    try {
        const { gameUrl } = req.body;
        
        if (!gameUrl) {
            return res.status(400).json({ message: 'URL do jogo é obrigatória' });
        }

        console.log(`🔗 Obtendo links de: ${gameUrl}`);

        const browser = await initBrowser();
        page = await browser.newPage();
        
        await page.setDefaultNavigationTimeout(30000);
        await page.goto(gameUrl, { waitUntil: 'networkidle2' });

        // Extrair links de download
        const downloadLinks = await page.evaluate(() => {
            const links = [];
            const anchors = document.querySelectorAll('a');
            
            anchors.forEach(a => {
                const href = a.href;
                const text = a.textContent.trim().toLowerCase();
                
                if (href && (
                    href.includes('mega.nz') ||
                    href.includes('mediafire') ||
                    href.includes('1fichier') ||
                    href.includes('uploadhaven') ||
                    href.includes('gofile') ||
                    text.includes('download') ||
                    text.includes('baixar')
                )) {
                    links.push({
                        link: href,
                        text: a.textContent.trim(),
                        type: href.includes('mega.nz') ? 'mega' : 
                              href.includes('mediafire') ? 'mediafire' : 
                              'direct'
                    });
                }
            });
            
            // Remover duplicados
            const uniqueLinks = [];
            const seen = new Set();
            
            links.forEach(link => {
                if (!seen.has(link.link)) {
                    seen.add(link.link);
                    uniqueLinks.push(link);
                }
            });
            
            return uniqueLinks;
        });

        await page.close();

        console.log(`✅ Encontrados ${downloadLinks.length} links`);

        if (downloadLinks.length === 0) {
            return res.status(404).json({ message: 'Nenhum link de download encontrado' });
        }

        res.json({ downloadLinks });

    } catch (error) {
        console.error('❌ Erro ao obter links:', error.message);
        
        if (page) await page.close().catch(() => {});
        
        res.status(500).json({ 
            message: 'Erro ao obter links de download',
            error: error.message 
        });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Cleanup ao fechar
process.on('SIGINT', async () => {
    if (browser) await browser.close();
    process.exit(0);
});

app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
    console.log(`🌐 Usando Puppeteer para contornar problemas SSL`);
});