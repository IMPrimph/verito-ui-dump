import { uniqueNamesGenerator, adjectives, colors, animals } from 'unique-names-generator';

const randomName = uniqueNamesGenerator({
  dictionaries: [adjectives, colors, animals],
  separator: ' ',
  length: 2,
  style: 'capital'
});

console.log(randomName)