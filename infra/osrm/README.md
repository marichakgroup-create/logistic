Place an OpenStreetMap extract here as `region.osm.pbf` before running Compose.
Development example: download the Berlin extract from https://download.geofabrik.de/europe/germany/berlin.html and rename it.
The osrm-data service extracts, partitions and customizes it. Production requires an extract covering all supported routes (Europe).
OSRM is intentionally not started with fabricated routing data.
