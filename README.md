# Schema Forge

This library is a set of utilities for generating JSON schemas from TypeScript types of your project, as well as for validating data according to these schemas.

### Please note: _Instruction is under construction_
Use `./test-sources` directory and `*.spec`-files for examples.

## Generator

You can organize your types and interfaces in such a way that it is they who generate the json-schema. 
Thus, unnecessary types will not get into the result. You can also control the descriptions of types and the selectivity of interface members and individual types (be careful with these features, they can lead to the impossibility of full validation on the side that will use this data).

### How it works?

Main idea is to create type descriptions by whose schemes in the future it will be possible to validate arbitrary data.


## Validator
 
todo
