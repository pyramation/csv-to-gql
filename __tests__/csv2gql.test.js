import { resolve } from 'path';
import { parse } from '../src';
import {
  CreateMutation,
  makePoint,
  makePoly,
  makeJS,
  parseVariables
} from '../src/utils';

const CSV = resolve(__dirname + '/../__fixtures__/zip-codes.csv');

it('insert each one', async () => {
  const result = await parse(CSV);

  const fields = [
    {
      name: 'zip',
      type: 'Int'
    },
    {
      name: 'location',
      type: 'GeoJSON',
      coercion: (record) => makePoint(record)
    },
    {
      name: 'bbox',
      type: 'GeoJSON',
      coercion: (record) => makePoly(record)
    }
  ];

  const mutation = CreateMutation({
    mutationName: 'createZipCode', // this doesnt matter
    modelName: 'zipCode', // query.one
    operationName: 'createZipCode', // query.create
    fields
  });

  const variablesArrays = result.map((record) => {
    return parseVariables(fields, record);
  });
  const js = makeJS({
    mutation,
    gqlUrl: 'http://my/graphql',
    jsonOut: '/path/to.json'
  });
  expect(js).toMatchSnapshot();
  // require('fs').writeFileSync(__dirname + '/../testit.js', js);
  expect(variablesArrays).toMatchSnapshot();
});
