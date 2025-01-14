FROM mongodb/mongodb-community-server:7.0.7-ubuntu2204

ENV MONGODB_INITDB_DATABASE=cooksta
ENV MONGODB_INITDB_ROOT_USERNAME=root
ENV MONGODB_INITDB_ROOT_PASSWORD=rootPW

USER root
COPY mongodb-init.js /docker-entrypoint-initdb.d/mongodb-init.js
RUN chmod +x /docker-entrypoint-initdb.d/mongodb-init.js

USER mongodb
