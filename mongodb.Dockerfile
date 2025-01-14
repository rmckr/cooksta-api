FROM mongodb/mongodb-community-server:7.0.7-ubuntu2204
COPY mongodb-init.js /docker-entrypoint-initdb.d/mongodb-init.js
RUN chmod +x /docker-entrypoint-initdb.d/mongodb-init.js
