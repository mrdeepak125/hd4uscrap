// Stream URL Scraper - Fixed Version with Full Debug Logging
const axios = require('axios');
const cheerio = require('cheerio');

// ─── Logger ──────────────────────────────────────────────────────────────────
const log = {
    info:    (...a) => console.log ('\x1b[36m[INFO ]\x1b[0m', ...a),
    success: (...a) => console.log ('\x1b[32m[OK   ]\x1b[0m', ...a),
    warn:    (...a) => console.warn('\x1b[33m[WARN ]\x1b[0m', ...a),
    error:   (...a) => console.error('\x1b[31m[ERR  ]\x1b[0m', ...a),
    debug:   (...a) => console.log ('\x1b[90m[DEBUG]\x1b[0m', ...a),
    sep:     ()     => console.log ('\x1b[90m' + '─'.repeat(60) + '\x1b[0m'),
    req:  (method, url) => console.log('\x1b[35m[REQ  ]\x1b[0m', method.toUpperCase(), url),
    res:  (status, url, extra = '') => {
        const color = status < 300 ? '\x1b[32m' : status < 400 ? '\x1b[33m' : '\x1b[31m';
        console.log(`${color}[RES  ]\x1b[0m`, `HTTP ${status}`, url, extra);
    }
};

// ─── Axios instance factory ───────────────────────────────────────────────────
function makeClient(extraHeaders = {}) {
    const client = axios.create({
        timeout: 15000,
        headers: {
            'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Referer':         'https://new5.hdhub4u.fo',
            'Cookie':          'xla=s4t',
            ...extraHeaders
        }
    });

    // Log every outgoing request
    client.interceptors.request.use(config => {
        log.sep();
        log.req(config.method, config.url);
        log.debug('Request headers:', JSON.stringify(
            // Hide cookie value in logs for brevity
            { ...config.headers, Cookie: config.headers.Cookie ? '***' : undefined },
            null, 2
        ));
        if (config.params) log.debug('Query params:', JSON.stringify(config.params, null, 2));
        return config;
    });

    // Log every response
    client.interceptors.response.use(
        response => {
            const kb = (JSON.stringify(response.data).length / 1024).toFixed(1);
            log.res(response.status, response.config.url, `| ${kb} KB`);
            return response;
        },
        error => {
            const status = error.response?.status ?? 'NO_RESPONSE';
            const url    = error.config?.url      ?? 'unknown';
            const body   = error.response?.data;
            log.res(typeof status === 'number' ? status : 0, url);
            log.error('Request failed:', error.message);
            if (body) {
                const snippet = typeof body === 'string' ? body.slice(0, 400) : JSON.stringify(body).slice(0, 400);
                log.debug('Error response body:', snippet);
            }
            return Promise.reject(error);
        }
    );

    return client;
}

// ─── StreamScraper ────────────────────────────────────────────────────────────
class StreamScraper {
    constructor() {
        this.searchApiUrl = 'https://search.pingora.fyi/collections/post/documents/search';
        this.siteUrl      = 'https://new5.hdhub4u.fo/';
        this._apiKey      = null;

        // siteClient → HTML page fetching & API key extraction
        this.siteClient = makeClient();
        // apiClient  → built after key is extracted
        this.apiClient  = null;
    }

    // ── Extract the Typesense API key dynamically from the site HTML ──────────
    async _fetchApiKey() {
        if (this._apiKey) {
            log.debug('API key already cached:', this._apiKey);
            return this._apiKey;
        }

        log.info('Extracting Typesense API key from site HTML…');

        try {
            const res  = await this.siteClient.get(this.siteUrl);
            const html = res.data;

            // Patterns to find the Typesense key inside inline <script> tags
            const patterns = [
                /['"X\-TYPESENSE\-API\-KEY'":\s]*['"]([a-zA-Z0-9_\-]{8,})['"]/i,
                /typesense[_\-]?api[_\-]?key[^'"]*['"]([a-zA-Z0-9_\-]{8,})['"]/i,
                /['"]X-TYPESENSE-API-KEY['"]\s*,\s*['"]([a-zA-Z0-9_\-]{8,})['"]/i,
                /apiKey\s*[:=]\s*['"]([a-zA-Z0-9_\-]{8,})['"]/i,
                /key\s*[:=]\s*['"]([a-zA-Z0-9_\-]{16,})['"]/i,   // broader fallback
            ];

            let key = null;
            const $ = cheerio.load(html);

            // Only look inside <script> tags (not external src)
            $('script:not([src])').each((i, el) => {
                if (key) return false; // already found
                const code = $(el).html() || '';
                if (!code.includes('pingora') && !code.includes('typesense') && !code.includes('apiKey')) return;

                log.debug(`Scanning inline script [${i}] (${code.length} chars)…`);

                for (const pattern of patterns) {
                    const match = code.match(pattern);
                    if (match && match[1]) {
                        key = match[1];
                        log.success(`API key matched by pattern: ${pattern}`);
                        log.debug(`Key value: ${key}`);
                        return false; // break $.each
                    }
                }

                // Dump a snippet to help debug when nothing matched
                log.debug('No key found in this script. First 600 chars:');
                log.debug(code.slice(0, 600));
            });

            if (!key) {
                log.warn('Auto-extraction failed. Listing all inline scripts that mention relevant keywords:');
                $('script:not([src])').each((i, el) => {
                    const code = $(el).html() || '';
                    if (code.includes('pingora') || code.includes('search') || code.includes('api')) {
                        log.debug(`── Script [${i}] (${code.length} chars) ──`);
                        log.debug(code.slice(0, 800));
                    }
                });
                throw new Error(
                    'Could not extract API key from site HTML.\n' +
                    'Check the DEBUG output above and manually set this._apiKey in the constructor.'
                );
            }

            this._apiKey  = key;
            this.apiClient = makeClient({
                'X-TYPESENSE-API-KEY': key,
                'Accept':              'application/json'
            });

            return key;

        } catch (err) {
            log.error('_fetchApiKey() failed:', err.message);
            throw err;
        }
    }

    // ── Search via Typesense JSON API ─────────────────────────────────────────
    async searchMovies(query, page = 1) {
        log.sep();
        log.info(`searchMovies() → query="${query}" page=${page}`);

        try {
            if (!query || typeof query !== 'string') throw new Error('Invalid search query');

            await this._fetchApiKey();

            const today  = new Date().toISOString().split('T')[0];
            const params = {
                q:                query,
                query_by:         'post_title,category,stars,director,imdb_id',
                query_by_weights: '4,2,2,2,4',
                sort_by:          'sort_by_date:desc',
                per_page:         15,
                highlight_fields: 'none',
                use_cache:        'true',
                page:             page,
                analytics_tag:    today
            };

            log.debug('Typesense params:', JSON.stringify(params, null, 2));

            const res  = await this.apiClient.get(this.searchApiUrl, { params });
            const data = res.data;

            log.debug('API response top-level keys:', Object.keys(data).join(', '));
            log.debug(`found=${data.found}  hits=${data.hits?.length ?? 0}  page=${data.page}`);

            if (!data.hits || data.hits.length === 0) {
                log.warn('Zero hits returned.');
                return { success: true, movies: [], total: 0, message: `No results for "${query}"` };
            }

            const movies = data.hits.map(hit => {
                const doc = hit.document;
                log.debug(`  • ${doc.post_title}  →  ${doc.permalink}`);
                return {
                    title:    doc.post_title     || '',
                    link:     doc.permalink      || '',
                    image:    doc.post_thumbnail || '',
                    category: doc.category       || '',
                    date:     doc.post_date      || ''
                };
            });

            log.success(`searchMovies() → ${movies.length} movies  (total API found: ${data.found})`);
            return { success: true, movies, total: data.found || movies.length, message: `Found ${data.found} results for "${query}"` };

        } catch (err) {
            log.error('searchMovies() failed:', err.message);
            return { success: false, error: err.message, message: 'Failed to search movies' };
        }
    }

    // ── Fetch a page and extract watch / download links ───────────────────────
async getWatchLinks(link) {
    log.sep();
    log.info(`getWatchLinks() → ${link}`);

    try {
        if (!link || typeof link !== 'string') {
            throw new Error('Invalid link');
        }

        // ✅ FIX 1: Convert relative URL → absolute
        if (link.startsWith('/')) {
            link = this.siteUrl.replace(/\/$/, '') + link;
        }

        const res = await this.siteClient.get(link);
        const $   = cheerio.load(res.data);

        const title =
            $('h1.entry-title').first().text().trim() ||
            $('h2').first().text().trim() ||
            $('title').text().replace(/[-|].*/, '').trim();

        log.debug('Parsed page title:', title);

        const episodes = [];

        // ─────────────────────────────────────────────
        // ✅ Strategy 1: Episode-wise extraction
        // ─────────────────────────────────────────────
        $('h4').each((i, el) => {
            const episodeLabel = $(el)
                .find('span[style*="color"]')
                .text()
                .trim();

            if (!episodeLabel) return;

            const watchLinks = [];

            $(el).nextAll('h4, p, div').slice(0, 6).each((j, sibling) => {
                $(sibling).find('a[href]').each((_k, anchor) => {
                    const href = $(anchor).attr('href') || '';
                    const text = $(anchor).text().trim();

                    if (_isStreamLink(href, text)) {
                        const label = text || 'Player';

                        watchLinks.push({
                            type: _detectStreamType(href, text),
                            label: label,   // ✅ PLAYER-1 / PLAYER-2 preserved
                            url: href
                        });

                        log.debug(`→ [${label}] ${href}`);
                    }
                });

                // stop at next episode
                if (j > 0 && $(sibling).find('span[style*="color"]').length) {
                    return false;
                }
            });

            if (watchLinks.length) {
                episodes.push({
                    episode: episodeLabel,
                    watchLinks
                });
            }
        });

        // ─────────────────────────────────────────────
        // ✅ Strategy 2: All stream links (movie page)
        // ─────────────────────────────────────────────
        if (episodes.length === 0) {
            const seen = new Set();
            const all  = [];

            $('a[href]').each((_i, anchor) => {
                const href = $(anchor).attr('href') || '';
                const text = $(anchor).text().trim();

                if (_isStreamLink(href, text) && !seen.has(href)) {
                    seen.add(href);

                    const label = text || 'Player';

                    all.push({
                        type: _detectStreamType(href, text),
                        label: label,
                        url: href
                    });

                    log.debug(`→ [${label}] ${href}`);
                }
            });

            if (all.length) {
                episodes.push({
                    episode: 'Movie',
                    watchLinks: all
                });
            }
        }

        // ─────────────────────────────────────────────
        // ❌ Nothing found
        // ─────────────────────────────────────────────
        if (episodes.length === 0) {
            throw new Error('No watch links found');
        }

        log.success(`getWatchLinks() → ${episodes.length} section(s)`);

        return {
            success: true,
            info: {
                title,
                link,
                episodes
            },
            message: 'Successfully fetched watch links'
        };

    } catch (err) {
        log.error('getWatchLinks() failed:', err.message);
        return {
            success: false,
            error: err.message,
            message: 'Failed to fetch watch links'
        };
    }
}

    // ── Search + get watch links for every result ─────────────────────────────
    async searchAndGetWatchLinks(query, page = 1) {
        log.sep();
        log.info(`searchAndGetWatchLinks() → query="${query}" page=${page}`);

        try {
            if (!query || typeof query !== 'string') throw new Error('Invalid search query');

            const searchResult = await this.searchMovies(query, page);
            if (!searchResult.success) return searchResult;
            if (!searchResult.movies.length) {
                return { success: true, movies: [], message: `No movies found for "${query}"` };
            }

            log.info(`Processing ${searchResult.movies.length} movie(s)…`);
            const moviesWithLinks = [];

            for (const [i, movie] of searchResult.movies.entries()) {
                log.info(`[${i + 1}/${searchResult.movies.length}] "${movie.title}"`);
                if (!movie.link) { log.warn('  No permalink — skipping'); continue; }

                const watchResult = await this.getWatchLinks(movie.link);
                moviesWithLinks.push({
                    title:    movie.title,
                    image:    movie.image,
                    link:     movie.link,
                    episodes: watchResult.success ? watchResult.info.episodes : []
                });
            }

            log.success(`searchAndGetWatchLinks() done → ${moviesWithLinks.length} movie(s) returned`);
            return {
                success: true,
                total:   searchResult.total,
                movies:  moviesWithLinks,
                message: `Found ${moviesWithLinks.length} movies matching "${query}"`
            };

        } catch (err) {
            log.error('searchAndGetWatchLinks() failed:', err.message);
            return { success: false, error: err.message, message: 'Failed to search and fetch watch links' };
        }
    }

    getCategories() {
        return [
            { title: 'Latest',       filter: '' },
            { title: 'Web Series',   filter: '/category/web-series' },
            { title: 'Hollywood',    filter: '/category/hollywood-movies' },
            { title: 'South Movies', filter: '/category/south-hindi-movies' }
        ];
    }

    getGenres() {
        return [
            { title: 'Action',   filter: '/category/action' },
            { title: 'Crime',    filter: '/category/crime' },
            { title: 'Comedy',   filter: '/category/comedy' },
            { title: 'Drama',    filter: '/category/drama' },
            { title: 'Horror',   filter: '/category/horror' },
            { title: 'Family',   filter: '/category/family' },
            { title: 'Sci-Fi',   filter: '/category/sifi' },
            { title: 'Thriller', filter: '/category/triller' },
            { title: 'Romance',  filter: '/category/romance' },
            { title: 'Fight',    filter: '/category/fight' }
        ];
    }
}

// ─── Link classification helpers ─────────────────────────────────────────────
function _isStreamLink(href, text = '') {
    return (
        href.includes('hubstream') ||
        href.includes('hdstream') ||
        href.includes('stream4u') ||
        href.includes('streamhub') ||
        href.includes('vidsrc') ||
        href.includes('embed') ||
        (href.includes('watch') && href.startsWith('http')) ||
        /player/i.test(text)   // ✅ detect PLAYER-1, PLAYER-2
    );
}

function _isDownloadLink(href) {
    return (
        href.includes('drive.google') ||
        href.includes('gdrive')       ||
        href.includes('mega.nz')      ||
        href.includes('mediafire')    ||
        href.includes('zippyshare')
    );
}

function _detectStreamType(href, text = '') {
    if (href.includes('hubstream')) return 'HubStream';
    if (href.includes('hdstream')) return 'HDStream';
    if (href.includes('vidsrc')) return 'VidSrc';

    if (/player/i.test(text)) return text.trim(); // ✅ PLAYER-1, PLAYER-2

    if (text) return text.split(/\s+/)[0];

    return 'Stream';
}

module.exports = StreamScraper;