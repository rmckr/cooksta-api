#!/bin/bash
exec > >(tee /tmp/mongodb-init.log) 2>&1

user="cooksta"
pswd="cookstaPW"
auth_db="cooksta"

echo "⏳ Waiting for MongoDB to start..."
until mongosh --quiet --username $user --password $pswd --authenticationDatabase $auth_db --eval "db.runCommand({ ping: 1 })" > /dev/null; do
  sleep 3
done
echo "✅ MongoDB is ready!"

import_files() {
  local collection="$1"
  echo "📂 Importing files from /init/$collection/ into collection '$collection'..."

  # Loop over JSON files
  for jsonfile in /init/"$collection"/*.json; do
    [[ -f "$jsonfile" ]] || continue

    local basename
    basename=$(basename "$jsonfile" | cut -d '.' -f1)
    local contextid
    contextid=$(grep -oP '"_id":\s*"\K[^"]+' "$jsonfile")

    local json_exists
    json_exists=$(mongosh cooksta --quiet --username $user --password $pswd --authenticationDatabase $auth_db --eval "
      db.$collection.findOne({ _id: ObjectId('$contextid') }) ? true : false;
    ")
    if [[ $json_exists == "false" ]]; then
      echo "📄 Inserting new document: $contextid"
      mongosh cooksta --quiet --username $user --password $pswd --authenticationDatabase $auth_db --eval "
        const data = $(cat "$jsonfile");
        if (data._id && /^[a-fA-F0-9]{24}$/.test(data._id)) {
          data._id = ObjectId(data._id);
        }
        db.$collection.insertOne(data);
      " > /dev/null
    else
      echo "✅ Document '$contextid' already exists, skipping insert."
    fi

    # Find the corresponding media file
    local mediafile
    local filetype
    local prefix
    if [[ "$collection" == "users" ]]; then
      if [[ -f "/init/$collection/$basename.png" ]]; then
        mediafile="/init/$collection/$basename.png"
        filetype="png"
        prefix="avatar"
      fi
    elif [[ "$collection" == "recipes" ]]; then
      if [[ -f "/init/$collection/$basename.png" ]]; then
        mediafile="/init/$collection/$basename.png"
        filetype="png"
        prefix="image"
      elif [[ -f "/init/$collection/$basename.mp4" ]]; then
        mediafile="/init/$collection/$basename.mp4"
        filetype="mp4"
        prefix="video"
      fi
    fi

    if [[ -f $mediafile ]]; then
      local filename="$prefix-$contextid"
      local metadata="{\"contextId\": \"$contextid\", \"contentType\": \"image/$filetype\"}"

      file_exists=$(mongosh gridfs --quiet --username $user --password $pswd --authenticationDatabase $auth_db --eval "
        var file = db.$collection.files.findOne({ filename: '$filename' });
        file ? true : false;
      ")

      if [[ $file_exists == "false" ]]; then
        echo "📥 Uploading media file: $filename"
        mongofiles --host localhost --username $user --password $pswd --authenticationDatabase $auth_db --db gridfs --prefix "$collection" put --local "$mediafile" "$filename" > /dev/null
        mongosh gridfs --quiet --username $user --password $pswd --authenticationDatabase $auth_db --eval "
          db.$collection.files.updateOne(
            { filename: '$filename' },
            { \$set: { metadata: $metadata } }
          );
        " > /dev/null
      else
        echo "✅ Media file '$filename' already exists, skipping upload."
      fi
    fi
  done
}

import_files "users"
import_files "recipes"
echo "✅ Database initialization complete!"
