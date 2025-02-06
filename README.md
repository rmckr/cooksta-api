# Cooksta API

---

A simple MongoDB and Express backend for [cooksta-app](https://gitlab.dit.htwk-leipzig.de/cooksta/cooksta-app).\
Supports various API endpoints defined in [openapi.yaml](openapi.yaml)

---

## Getting started

### Docker

Clone this repository:
```shell
git clone https://gitlab.dit.htwk-leipzig.de/cooksta/cooksta-api.git
cd cooksta-api
```
Alternatively, use SSH to clone: `git@gitlab.dit.htwk-leipzig.de:cooksta/cooksta-api.git`.

Start the server:
```shell
docker compose up -d
```

Once up and running, the API will be available at `http://localhost:9000/api`.

### Local Setup

Clone this repository:
```shell
git clone https://gitlab.dit.htwk-leipzig.de/cooksta/cooksta-api.git
cd cooksta-api
```

Install dependencies:
```shell
npm install
```

Start the development server:
```shell
npm run dev
```

The server will automatically restart once it detects changes to the source files.

Once up and running, the API will be available at `http://localhost:3000/api`.

---

## Usage

### Endpoints
Check [openapi.yaml](openapi.yaml) for a complete endpoint documentation.

### Example Request
```shell
curl -X GET http://localhost:9000/api/recipes
```

---