#!/bin/bash
exec > >(tee /tmp/mongodb-init.log) 2>&1

user="cooksta"
pswd="cookstaPW"
auth_db="cooksta"
auth="--username $user --password $pswd --authenticationDatabase $auth_db"

echo "⏳ Waiting for MongoDB to start..."
until mongosh $auth --quiet --eval "db.runCommand({ ping: 1 })" > /dev/null; do
  sleep 3
done
echo "✅ MongoDB is ready!"

insert_json() {
  local collection="$1"
  echo "📂 Importing files from /init/$collection/ into collection '$collection'..."

  local json_insert="use cooksta;\n"
  for jsonfile in /init/"$collection"/*.json; do
    [[ -f "$jsonfile" ]] || continue

    local id
    id=$(grep -oP '"_id":\s*"\K[^"]+' "$jsonfile")

    json_insert+="
      if (!db.$collection.findOne({ _id: ObjectId('$id') })) {
        const raw = fs.readFileSync('$jsonfile', 'utf8')
        print(raw)
        let data = JSON.parse(raw);
        if (data._id && /^[a-fA-F0-9]{24}$/.test(data._id)) {
          data._id = ObjectId(data._id);
        }
        db.$collection.insertOne(data);
        print('📄 Inserted: $id');
      } else {
        print('✅ Skipped: $id (already exists)');
      }
    "
  done

  echo -e "$json_insert" | mongosh cooksta $auth --quiet
}

upload_files() {
  local collection="$1"
  local metadata_updates="use gridfs;\n"

  for jsonfile in /init/"$collection"/*.json; do
    [[ -f "$jsonfile" ]] || continue

    local basename
    basename=$(basename "$jsonfile" | cut -d '.' -f1)
    local contextid
    contextid=$(grep -oP '"_id":\s*"\K[^"]+' "$jsonfile")

    local mediafile
    local mimetype
    local prefix
    if [[ "$collection" == "users" ]]; then
      if [[ -f "/init/$collection/$basename.png" ]]; then
        mediafile="/init/$collection/$basename.png"
        mimetype="image/png"
        prefix="avatar"
      fi
    elif [[ "$collection" == "recipes" ]]; then
      if [[ -f "/init/$collection/$basename.png" ]]; then
        mediafile="/init/$collection/$basename.png"
        mimetype="image/png"
        prefix="image"
      elif [[ -f "/init/$collection/$basename.mp4" ]]; then
        mediafile="/init/$collection/$basename.mp4"
        mimetype="video/mp4"
        prefix="video"
      fi
    fi

    local filename="$prefix-$contextid"
    local metadata="{\"contextId\": \"$contextid\", \"contentType\": \"$mimetype\"}"

    if [[ -n "$mediafile" ]]; then
      echo "📥 Uploading media file: $filename"
      mongofiles $auth --host localhost --db gridfs --prefix "$collection" put --local "$mediafile" "$filename"
      metadata_updates+="
        db.$collection.files.updateOne(
          { filename: '$filename' },
          { \$set: { metadata: $metadata } }
        );
      "
    fi
  done

  echo -e "$metadata_updates" | mongosh gridfs $auth --quiet
}

import_data() {
  for collection in "users" "recipes"; do
    insert_json "$collection"
    upload_files "$collection"
  done
}

import_data
echo "✅ Database initialization complete!"
