import * as t from 'gql-ast';
import { basename } from 'path';
import { print } from 'graphql';

const NON_MUTABLE_PROPS = [
  'id',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy'
];

export const parseVariables = (fields, record) =>
  fields.reduce((m, field) => {
    if (typeof field.coercion === 'undefined') {
      if (['Int', 'BigInt', 'Float', 'BigFloat'].includes(field.type)) {
        m[field.name] = Number(record[field.name]);
      } else {
        m[field.name] = record[field.name];
      }
    } else if (typeof field.coercion === 'function') {
      m[field.name] = field.coercion(record);
    } else {
      throw new Error(
        'dont know how to deal with type ' + typeof field.coercion
      );
    }
    return m;
  }, {});

export const makePoint = ({ longitude, latitude }) => ({
  type: 'Point',
  coordinates: [longitude, latitude]
});

const bboxSplit = (bbox) => {
  const [lng1, lat1, lng2, lat2] = bbox.split(',').map((a) => a.trim());
  return [
    [lng1, lat1],
    [lng1, lat2],
    [lng2, lat2],
    [lng2, lat1],
    [lng1, lat1]
  ];
};

export const makePoly = ({ bbox }) => {
  return {
    type: 'Polygon',
    coordinates: [bboxSplit(bbox)]
  };
};

const getNames = (operationName, model) => {
  const Singular = model;
  const Plural = operationName.charAt(0).toUpperCase() + operationName.slice(1);
  const Condition = `${Singular}Condition`;
  const Filter = `${Singular}Filter`;
  const OrderBy = `${Plural}OrderBy`;
  return {
    Singular,
    Plural,
    Condition,
    Filter,
    OrderBy
  };
};
const objectToArray = (obj) =>
  Object.keys(obj).map((k) => ({ name: k, ...obj[k] }));

export const CreateMutation = ({
  mutationName,
  operationName,
  modelName,
  fields
}) => {
  const allAttrs = objectToArray(fields);

  const attrs = allAttrs.filter(
    (field) => !NON_MUTABLE_PROPS.includes(field.name)
  );

  return t.document({
    definitions: [
      t.operationDefinition({
        operation: 'mutation',
        name: mutationName,
        variableDefinitions: attrs.map((field) => {
          const { name: fieldName, type: fieldType } = field;
          const type = t.namedType({ type: fieldType });
          return t.variableDefinition({
            variable: t.variable({ name: fieldName }),
            type
          });
        }),
        selectionSet: t.selectionSet({
          selections: [
            t.field({
              name: operationName,
              args: [
                t.argument({
                  name: 'input',
                  value: t.objectValue({
                    fields: [
                      t.objectField({
                        name: modelName,
                        value: t.objectValue({
                          fields: attrs.map((field) =>
                            t.objectField({
                              name: field.name,
                              value: t.variable({
                                name: field.name
                              })
                            })
                          )
                        })
                      })
                    ]
                  })
                })
              ],
              selectionSet: t.selectionSet({
                selections: [
                  t.field({
                    name: 'clientMutationId'
                  })
                ]
              })
            })
          ]
        })
      })
    ]
  });
};

export const makeJS = ({ mutation, gqlUrl, jsonOut }) => {
  const mutationStr = print(mutation);
  return `
import gql from 'graphql-tag';
import { GraphQLClient } from 'graphql-request';
import elements from './${basename(jsonOut)}';

const Mutation = gql\`
${mutationStr}\`;

const client = new GraphQLClient(
  '${gqlUrl}'
);

const main = async () => {

  for (let i=0; i<elements.length; i++) {
    const variables = elements[i];
    const result = await client.request(Mutation, variables);
    console.log(JSON.stringify(result));
  }
};

main();
`;
};
