const config = require('./../../infrastructure/config');
const rp = require('request-promise');
const fs = require('fs');
const { parse: parseUrl } = require('url');
const { basename: getFileName } = require('path');
const { promisify } = require('util');

const statAsync = promisify(fs.stat);

const copyFileToBlob = async (path) => {
  const stat = await statAsync(path);

  const url = parseUrl(config.oldSecureAccess.backup.archiveUri);
  const fileName = getFileName(path);
  const uploadUri = `${url.protocol}//${url.host}${url.pathname}/${fileName}?${url.query}`;

  await rp({
    method: 'PUT',
    uri: uploadUri,
    headers: {
      'content-type': 'application/octet-stream',
      'x-ms-version': '2015-02-21',
      'x-ms-blob-type': 'AppendBlob',
    },
  });

  if (stat.size > 0) {
    await new Promise((resolve, reject) => {
      const stream = fs.createReadStream(path);
      stream.on('readable', async () => {
        let block;
        while (null !== (block = stream.read(4194304))) {
          await rp({
            method: 'PUT',
            uri: `${uploadUri}&comp=appendblock`,
            headers: {
              'x-ms-version': '2015-02-21',
              'content-length': block.length,
            },
            body: block,
            json: false,
          });
        }
      });
      stream.on('end', () => {
        resolve();
      });
      stream.on('error', reject);
    });
  }
};

module.exports = {
  copyFileToBlob,
};
