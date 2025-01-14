# Cooksta API

---

A simple MongoDB and Express backend for [cooksta-app](https://gitlab.dit.htwk-leipzig.de/cooksta/cooksta-app).\
Supports various API endpoints defined in [openapi.yaml](openapi.yaml)

---

## Getting started

### Docker (Pre-built)

Go to [docker-compose.prebuilt.yaml](docker-compose.prebuilt.yaml) and download the file from GitLab\
or use this
[direct download link](https://gitlab.dit.htwk-leipzig.de/cooksta/cooksta-api/-/raw/main/docker-compose.prebuilt.yaml).

Login to the GitLab Docker Container Registry:
```shell
docker login gitlab.dit.htwk-leipzig.de:5050
```
If not previously configured, this will ask you for your GitLab username and a password (token).
Use your Docker Registry token instead of a password.

> You can find your GitLab username when clicking your profile icon in the sidebar (without @).\
> Create a Docker Registry token
> [using this link](https://gitlab.dit.htwk-leipzig.de/-/user_settings/personal_access_tokens?name=Docker%20Registry%20Token&scopes=read_registry%2Cwrite_registry)
> if you do not have one.

In the same directory as the `docker-compose.prebuilt.yaml`, start the server:
```shell
docker compose -f .\docker-compose.prebuilt.yaml up -d
```

Once up and running, the API will be available at `http://localhost:9000/api`.

### Docker Compose

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