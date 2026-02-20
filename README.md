# DVPI Web Calculator

A web-based version of the DVPImaster application for calculating DVPI (Danish Vegetation Index) values.

## Features

- Upload CSV files with Danish vegetation data
- Drag-and-drop file upload support
- Automatic parsing of Danish CSV format with columns:
  - Art latin / Videnskabeligt navn (Latin species name)
  - Transektundersøgelse / Transektnr. (Transect)
  - Kvadrat nummer / Kvadratnr. (Quadrat number)
  - Arts tom / Uden art (Empty species flag)
  - Dækningsgrad (optional; not shown in manual entry grid)
- Species code mapping from stancode_utf8.csv
- SOAP service integration with DVPI calculation service
- Results display in a downloadable grid format

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Install backend dependencies:
```bash
npm install
```

2. Install frontend dependencies:
```bash
cd client
npm install
cd ..
```

Or use the convenience script:
```bash
npm run install-all
```

## Running the Application

### Development Mode

1. Start the backend server:
```bash
npm start
# or
npm run dev  # with auto-reload
```

2. In a separate terminal, start the frontend:
```bash
cd client
npm start
```

The frontend will be available at http://localhost:3000
The backend API will be available at http://localhost:3001

### Production Build

1. Build the frontend:
```bash
npm run build
```

2. The built files will be in `client/build/`. You can serve them with any static file server or configure the Express server to serve them.

## Environment Variables

Optional environment variables:

- `DVPI_USERNAME`: Username for DVPI service (default: "sa-feltreg")
- `DVPI_PASSWORD`: Password for DVPI service (default: hardcoded value)
- `PORT`: Backend server port (default: 3001)

## CSV File Format

The application expects CSV files with the following columns (Danish headers):

- `Stedtype`
- `StedID`
- `Art latin` (required)
- `Transektundersøgelse`
- `Kvadrat nummer`
- `Arts tom` (rows with "Ja" are skipped)
- `Dækningsgrad` (optional; used if present in CSV)

The CSV can be semicolon, comma, or tab-delimited.

## Species Code Mapping

The application looks for `stancode_utf8.csv` in the following locations (in order):
1. `DVPImaster/bin/Debug/net8.0-windows/stancode_utf8.csv`
2. `DVPIClientApp/dvpi_app/data/stancode_utf8.csv`
3. `server/stancode_utf8.csv`

If not found, species codes will default to "0".

## API Endpoints

- `GET /api/health` - Health check
- `POST /api/process` - Process uploaded CSV file (multipart/form-data with 'file' field)

## Project Structure

```
DVPIweb/
├── server/
│   ├── index.js          # Express server
│   └── dvpiProcessor.js  # CSV parsing and DVPI logic
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.js
│   │   │   └── ResultsGrid.js
│   │   ├── App.js
│   │   └── index.js
│   └── public/
└── package.json
```

## Deployment

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).

Quick deployment steps:
1. Build the frontend: `npm run build`
2. Set environment variables (copy `.env.example` to `.env`)
3. Install PM2: `npm install -g pm2`
4. Start with PM2: `npm run pm2:start`
5. Set up Nginx reverse proxy (see DEPLOYMENT.md)

## Notes

- The logic closely follows the C# DVPImaster implementation
- CSV parsing handles various delimiters (semicolon, comma, tab)
- SOAP requests are built with proper XML escaping
- Results can be downloaded as CSV
- In production mode, the server serves the React app automatically
