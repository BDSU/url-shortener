#!/bin/sh

# error if env var is not set
set -e

mongosh <<EOF

use test-shortener
db.createCollection('urls');
db.createCollection('stats');

use shortener
db.createCollection('urls');
db.createCollection('stats');

db.createUser({
  user: '$API_USER',
  pwd: '$API_USER_PASS',
  roles: [{
    role: 'dbAdmin',
    db: 'shortener'
  }, {
    role: 'readWrite',
    db: 'shortener'
  }, {
    role: 'dbAdmin',
    db: 'test-shortener'
  }, {
    role: 'readWrite',
    db: 'test-shortener'
  }]
})

EOF

