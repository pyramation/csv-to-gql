#!/usr/bin/env node

import { prompt } from '@pyramation/prompt';
import { parse } from './parse';
import { writeFileSync } from 'fs';
import {
  CreateMutation,
  makePoint,
  makePoly,
  makeJS,
  parseVariables
} from './utils';

const argv = process.argv.slice(2);

// - [ ] option to rename fields
// - [ ] option to set table name
// - [ ] option to cast certain props
// - [ ] option to specify unique fields for on conflict updates

(async () => {
  // path to csv
  const { path } = await prompt(
    [
      {
        _: true,
        name: 'path',
        type: 'path',
        required: true
      }
    ],
    argv
  );

  // output paths
  const { out, jsonOut, gqlUrl } = await prompt(
    [
      {
        name: 'out',
        type: 'path',
        required: true
      },
      {
        name: 'gqlUrl',
        type: 'string',
        required: true
      },
      {
        name: 'jsonOut',
        type: 'path',
        required: true
      }
    ],
    argv
  );

  const records = await parse(path);

  const { modelName, operationName } = await prompt(
    [
      {
        name: 'modelName',
        type: 'text',
        required: true
      },
      {
        name: 'operationName',
        type: 'text',
        required: true
      }
    ],
    argv
  );
  let { fields } = await prompt(
    [
      {
        name: 'fields',
        type: 'text',
        required: true
      }
    ],
    argv
  );
  fields = fields.split(',');

  const qs = fields.map((field) => ({
    type: 'checkbox',
    name: field,
    message: 'choose props',
    choices: Object.keys(records[0]),
    required: true
  }));
  const ts = fields.map((field) => ({
    type: 'list',
    name: field,
    message: 'choose types',
    choices: ['int', 'text', 'float', 'location', 'bbox'],
    required: true
  }));

  console.log('FIRST LIST FIELDS FROM CSV');
  const thefields = await prompt(qs, []);
  console.log('NOW TYPES');
  const thetypes = await prompt(ts, []);

  const types = Object.entries(thetypes).reduce((m, val) => {
    const [k, v] = val;
    // m[k] = v;
    const other = thefields[k];
    if (!other) throw new Error('type/field mismatch');

    switch (v) {
      case 'text':
        m.push({
          name: k,
          type: 'String',
          coercion: (record) => record[other[0]]
        });
        break;
      case 'int':
        m.push({
          name: k,
          type: 'Int',
          coercion: (record) => Number(record[other[0]])
        });

        break;
      case 'float':
        m.push({
          name: k,
          type: 'Float',
          coercion: (record) => Number(record[other[0]])
        });
        break;
      case 'bbox':
        {
          // do bbox magic with args from the fields
          m.push({
            name: k,
            type: 'GeoJSON',
            coercion: (record) => makePoly({ bbox: record[other[0]] })
          });
        }
        break;
      case 'location':
        {
          // do bbox magic with args from the fields
          const [lngKey, latKey] = other;

          // do location magic with args from the fields
          m.push({
            name: k,
            type: 'GeoJSON',
            coercion: (record) =>
              makePoint({ longitude: record[lngKey], latitude: record[latKey] })
          });
        }
        break;
      default:
        // TODO WTF is the _????
        if (k === '_') {
          break;
        }
        m.push({
          name: k,
          type: 'String',
          coercion: (record) => record[other[0]]
        });
        break;
    }

    return m;
  }, []);

  const mutation = CreateMutation({
    mutationName: 'addDataViaCsvToGql',
    modelName,
    operationName,
    fields: types
  });

  const variablesArrays = records.map((record) => {
    return parseVariables(types, record);
  });
  const js = makeJS({
    mutation,
    gqlUrl,
    jsonOut
  });

  writeFileSync(out, js);
  writeFileSync(jsonOut, JSON.stringify(variablesArrays, null, 2));

  // IDEA: -- LEXER
  // fields = zip,location,bbox
  // types = int(zip),makeltln(longitude,latitude),makebbox(bbox)

  // another lexer idea:
  // types = 'int',fkey(bbox, s.table2)

  // BUG: chooser doesn't let you pick an order.... FUCK
  // yarn run dev ./__fixtures__/zip.csv  --fields zip,location,bbox
  // const deparsed = deparse([stmt]);
  // writeFileSync(out, deparsed);
})();
