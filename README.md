# Daikin Warranty Registration Automation

A Node.js service that automates the warranty registration process for Daikin HVAC systems. It provides a webhook endpoint that accepts product information and automatically registers the warranty on Daikin's website.

## Features

- Automated warranty registration using Playwright
- Webhook endpoint for easy integration
- Support for multiple products in a single request
- Automatic certificate cleanup
- Configurable environment settings
- Logging system
- Health check endpoint

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file in the root directory with the following variables:

```env
NODE_ENV=production
WEBHOOK_PORT=3000
FORM_URL=https://daikincomfort.com/my-daikin-systems/product-registration
```

## Usage

Start the server:

```bash
npm start
```

### Endpoints

- `POST /webhook/warranty-registration`: Main endpoint for warranty registration
- `POST /test`: Test endpoint with default data
- `GET /health`: Health check endpoint

### Example Payload

```json
{
  "products": [
    {
      "serial": "250151473",
      "model": "CAPEA4830C3"
    }
  ],
  "installationDate": "MM/DD/YYYY",
  "customer": {
    "firstName": "John",
    "lastName": "Doe",
    "phone": "1234567890",
    "email": "john@example.com",
    "address1": "123 Main St",
    "zipPostal": "12345",
    "city": "Ottawa",
    "stateProvince": "ON"
  }
}
```

## Development

For development:

```bash
npm run dev
```

## License

MIT
