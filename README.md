# Stream Scraper API

https://stream-scraper.onrender.com/search/raid 2


A Node.js API service that scrapes movie and series streaming links from hdhub4u.football. The API provides search functionality and returns watch links for both movies and TV series.

## Copyright Notice

Copyright (c) 2024 Stream Scraper API

All rights reserved.

This software and associated documentation files (the "Software") are protected by copyright law and international treaties. The Software is licensed, not sold.

The Software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the Software or the use or other dealings in the Software.

## Features

- Search for movies and TV series
- Get watch links for both movies and series episodes
- Support for multiple streaming sources (HubStream and HDStream)
- RESTful API endpoints
- Input validation and error handling
- CORS enabled

## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/hamoodhabibi30/stream-scraper
cd stream-scraper
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start on port 3000 by default. You can change this by setting the `PORT` environment variable.

## API Endpoints

### Search Movies/Series

#### Path Parameter Format
```
GET /search/:query
```

Example:
```
http://localhost:3000/search/peaky+blinders
```

#### Query Parameter Format
```
GET /search?q=query&page=1
```

Example:
```
http://localhost:3000/search?q=peaky+blinders&page=1
```

Parameters:
- `query`: Search term (required)
- `page`: Page number (optional, default: 1)

Response:
```json
{
  "success": true,
  "movies": [
    {
      "title": "Movie Title",
      "episodes": [
        {
          "episode": "Episode 1",
          "watchLinks": [
            {
              "type": "HubStream",
              "url": "https://hubstream.art/..."
            },
            {
              "type": "HDStream",
              "url": "https://hdstream4u.com/..."
            }
          ]
        }
      ]
    }
  ],
  "message": "Found X movies with watch links matching 'query'"
}
```

### Health Check
```
GET /health
```

Example:
```
http://localhost:3000/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-02-20T12:00:00.000Z"
}
```

### API Documentation
```
GET /
```

Example:
```
http://localhost:3000/
```

Returns API documentation and available endpoints.

## Error Handling

The API returns appropriate HTTP status codes:

- 200: Successful response
- 400: Invalid input (empty query, invalid page number)
- 404: No results found
- 500: Server error

Error Response Format:
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Development

### Project Structure
```
stream-scraper/
├── api.js           # Express server and API endpoints
├── stream_scraper.js # Core scraping functionality
├── package.json     # Project dependencies
└── README.md        # This file
```

### Dependencies
- express: Web framework
- axios: HTTP client
- cheerio: HTML parsing
- nodemon: Development auto-reload (dev dependency)

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Disclaimer

This tool is for educational purposes only. Please respect copyright laws and terms of service of the websites you interact with. 
