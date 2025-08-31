// Stream URL Scraper
const axios = require('axios');
const cheerio = require('cheerio');

class StreamScraper {
    constructor() {
        this.baseUrl = 'https://hdhub4u.menu';
        this.headers = {
            'Cookie': 'xla=s4t',
            'Referer': 'https://google.com',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
        };
        this.axiosInstance = axios.create({
            headers: this.headers,
            timeout: 10000 // 10 second timeout
        });
    }

    async searchMovies(query, page = 1) {
        try {
            if (!query || typeof query !== 'string') {
                throw new Error('Invalid search query');
            }

            const url = `${this.baseUrl}/page/${page}/?s=${encodeURIComponent(query)}`;
            const response = await this.axiosInstance.get(url);
            
            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const $ = cheerio.load(response.data);
            const movies = [];

            $('.recent-movies').children().each((i, element) => {
                const title = $(element).find('figure').find('img').attr('alt');
                const link = $(element).find('a').attr('href');

                if (title && link) {
                    movies.push({
                        title: title.replace('Download', '').trim(),
                        link: link
                    });
                }
            });

            return {
                success: true,
                movies: movies,
                message: `Found ${movies.length} movies matching "${query}"`
            };
        } catch (error) {
            console.error('Search error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search movies'
            };
        }
    }

    async getMovies(page = 1) {
        try {
            const url = `${this.baseUrl}/page/${page}/`;
            const response = await axios.get(url, { headers: this.headers });
            const $ = cheerio.load(response.data);
            const movies = [];

            $('.recent-movies').children().each((i, element) => {
                const title = $(element).find('figure').find('img').attr('alt');
                const link = $(element).find('a').attr('href');
                const image = $(element).find('figure').find('img').attr('src');

                if (title && link) {
                    movies.push({
                        title: title.replace('Download', '').trim(),
                        link: link,
                        image: image
                    });
                }
            });

            return {
                success: true,
                movies: movies,
                message: `Found ${movies.length} movies`
            };
        } catch (error) {
            return {
                success: false,
                error: error.message,
                message: 'Failed to fetch movies'
            };
        }
    }

    async getWatchLinks(link) {
        try {
            if (!link || typeof link !== 'string') {
                throw new Error('Invalid link');
            }

            const response = await this.axiosInstance.get(link);
            
            if (response.status !== 200) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const $ = cheerio.load(response.data);
            const title = $('h2 span[style*="font-family: \'Open Sans\'"]').first().text().trim();
            const episodes = [];
            
            // Find all episode sections
            $('h4').each((i, element) => {
                const episodeTitle = $(element).find('span[style*="color: #ff9900"]').text().trim();
                
                if (episodeTitle) {
                    const nextElement = $(element).next('h4');
                    const hubstreamLink = nextElement.find('a[href*="hubstream.art"]').attr('href');
                    const hdstreamLink = nextElement.find('a[href*="hdstream4u.com"]').attr('href');
                    
                    const watchLinks = [];
                    if (hubstreamLink) {
                        watchLinks.push({
                            type: 'HubStream',
                            url: hubstreamLink
                        });
                    }
                    if (hdstreamLink) {
                        watchLinks.push({
                            type: 'HDStream',
                            url: hdstreamLink
                        });
                    }
                    
                    if (watchLinks.length > 0) {
                        episodes.push({
                            episode: episodeTitle,
                            watchLinks: watchLinks
                        });
                    }
                }
            });

            // If no episodes found, try finding direct watch links
            if (episodes.length === 0) {
                const hubstreamLinks = [];
                const hdstreamLinks = [];
                
                $('a[href*="hubstream.art"]').each((i, element) => {
                    const watchLink = $(element).attr('href');
                    if (watchLink) {
                        hubstreamLinks.push({
                            type: 'HubStream',
                            url: watchLink
                        });
                    }
                });
                
                $('a[href*="hdstream4u.com"]').each((i, element) => {
                    const watchLink = $(element).attr('href');
                    if (watchLink) {
                        hdstreamLinks.push({
                            type: 'HDStream',
                            url: watchLink
                        });
                    }
                });
                
                const allLinks = [...hubstreamLinks, ...hdstreamLinks];
                if (allLinks.length > 0) {
                    episodes.push({
                        episode: 'Movie',
                        watchLinks: allLinks
                    });
                }
            }

            if (episodes.length === 0) {
                throw new Error('No watch links found');
            }

            return {
                success: true,
                info: {
                    title: title,
                    episodes: episodes
                },
                message: 'Successfully fetched watch links'
            };
        } catch (error) {
            console.error('Watch links error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to fetch watch links'
            };
        }
    }

    async searchAndGetWatchLinks(query, page = 1) {
        try {
            if (!query || typeof query !== 'string') {
                throw new Error('Invalid search query');
            }

            const searchResult = await this.searchMovies(query, page);
            if (!searchResult.success) {
                return searchResult;
            }

            const moviesWithLinks = [];
            for (const movie of searchResult.movies) {
                try {
                    const watchLinksResult = await this.getWatchLinks(movie.link);
                    if (watchLinksResult.success) {
                        moviesWithLinks.push({
                            title: movie.title,
                            episodes: watchLinksResult.info.episodes
                        });
                    }
                } catch (error) {
                    console.error(`Error fetching watch links for ${movie.title}:`, error.message);
                    continue; // Skip this movie and continue with others
                }
            }

            return {
                success: true,
                movies: moviesWithLinks,
                message: `Found ${moviesWithLinks.length} movies with watch links matching "${query}"`
            };
        } catch (error) {
            console.error('Search and watch links error:', error.message);
            return {
                success: false,
                error: error.message,
                message: 'Failed to search and fetch watch links'
            };
        }
    }

    // Get available categories
    getCategories() {
        return [
            {
                title: 'Latest',
                filter: ''
            },
            {
                title: 'Web Series',
                filter: '/category/web-series'
            },
            {
                title: 'Hollywood',
                filter: '/category/hollywood-movies'
            },
            {
                title: 'South Movies',
                filter: '/category/south-hindi-movies'
            }
        ];
    }

    // Get available genres
    getGenres() {
        return [
            { title: 'Action', filter: '/category/action' },
            { title: 'Crime', filter: '/category/crime' },
            { title: 'Comedy', filter: '/category/comedy' },
            { title: 'Drama', filter: '/category/drama' },
            { title: 'Horror', filter: '/category/horror' },
            { title: 'Family', filter: '/category/family' },
            { title: 'Sci-Fi', filter: '/category/sifi' },
            { title: 'Thriller', filter: '/category/triller' },
            { title: 'Romance', filter: '/category/romance' },
            { title: 'Fight', filter: '/category/fight' }
        ];
    }
}

// Example usage
const scraper = new StreamScraper();

// Example function to use the scraper
async function searchMoviesWithWatchLinks(query, page = 1) {
    const result = await scraper.searchAndGetWatchLinks(query, page);
    console.log(result);
    return result;
}

// Export the StreamScraper class
module.exports = StreamScraper; 
