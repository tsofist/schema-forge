import type { PRec } from '@tsofist/stem';
import { asArray } from '@tsofist/stem/lib/as-array';
import { isEqualKeys } from '@tsofist/stem/lib/equal-keys';
import { raise } from '@tsofist/stem/lib/error';
import { entries } from '@tsofist/stem/lib/object/entries';
import { snakeCase } from '@tsofist/stem/lib/string/case/snake';
import { compareStringsAsc } from '@tsofist/stem/lib/string/compare';
import { substr } from '@tsofist/stem/lib/string/substr';
import { TextBuilder } from '@tsofist/stem/lib/string/text-builder';
import type { JSONSchema7 as Schema } from 'json-schema';
import type { SchemaDefinitionInfoForType } from '../definition-info/types';
import {
    createSchemaDereferenceSharedCache,
    SchemaDereferenceSharedCache,
} from '../schema-dereference/cache';
import { dereferenceSchema } from '../schema-dereference/dereference';
import type { SchemaForgeRegistry } from '../schema-registry/types';
import type { ForgedEntitySchema, ForgedPropertySchema } from '../types';
import type {
    DBMLEntityOptions,
    DBMLGeneratorOptions,
    DBMLIndexOptions,
    DBMLIndexOptionsDef,
    DBMLProjectScope,
} from './types';

export function generateDBMLSpec(
    schemaRegistry: SchemaForgeRegistry,
    scopes: DBMLProjectScope[],
    options: DBMLGeneratorOptions = {},
) {
    const text = new TextBuilder();
    const tables = new Map<
        string, // table name
        TableSpec
    >();
    const groups = new Map<
        string, // group name
        string[] // table names
    >();
    const sources = new Map<
        string, // scope name
        DBMLProjectScope
    >();
    const dereferencedRootSchemas: Map<string, Schema> = new Map();

    if (options.meta?.comment) {
        text.push(`// ${options.meta?.comment}`);
    }
    text.push(`Project ${options.meta?.name ?? 'Scratch'} {`);
    text.push(`database_type: 'PostgreSQL'`, 1);
    if (options.meta?.note) {
        text.push('');
        text.push(buildNote(options.meta.note), 1);
    }
    text.push('}');
    text.push(``);

    for (const scope of scopes.sort((a, b) => {
        return compareStringsAsc(a.scopeName ?? DefaultScopeName, b.scopeName ?? DefaultScopeName);
    })) {
        if (sources.has(scope.scopeName ?? DefaultScopeName)) {
            raise(`Duplicate scope: ${scope.scopeName ?? '[ unnamed ]'}`);
        } else {
            sources.set(scope.scopeName ?? DefaultScopeName, scope);
        }
    }

    for (const { definitions, scopeName = DefaultScopeName, schemaId } of sources.values()) {
        let dereferencedRootSchema: Schema = dereferencedRootSchemas.get(schemaId)!;
        if (!dereferencedRootSchemas.has(schemaId)) {
            const root =
                schemaRegistry.getRootSchema(schemaId) ||
                raise(`Root schema ${schemaId} not found`);
            dereferencedRootSchema =
                dereferenceSchema(root, {
                    throwOnDereferenceFailure: true,
                    sharedCacheStorage:
                        DereferenceSchemaCache ||
                        (DereferenceSchemaCache = createSchemaDereferenceSharedCache()),
                }) || raise(`Failed to dereference root schema for ${schemaId}`);
            dereferencedRootSchemas.set(schemaId, dereferencedRootSchema);
        }

        for (const definition of definitions) {
            const tableSpec = generateTable(definition, options, dereferencedRootSchema);
            if (tableSpec) {
                if (tables.has(tableSpec.name)) {
                    raise(`Definitions contain duplicate table name: ${tableSpec.name}`);
                }

                tables.set(tableSpec.name, tableSpec);

                let groupTables = groups.get(scopeName);
                if (!groupTables) {
                    groupTables = [];
                    groups.set(scopeName, groupTables);
                }

                groupTables.push(tableSpec.name);
            }
        }
    }

    const defaultGroupOnly = groups.size === 1 && groups.has(DefaultScopeName);

    for (const [groupName, groupTableNames] of groups.entries()) {
        for (const tableName of groupTableNames.sort(compareStringsAsc)) {
            const table = tables.get(tableName)!;
            text.push(table.value);
            text.push(``);
        }

        if (!defaultGroupOnly) {
            const scope = sources.get(groupName);
            if (scope) {
                const comment = scope.comment;
                if (comment) {
                    text.push(`// ${comment}`);
                }
                text.push(`TableGroup ${groupName} {`);
                for (const tableName of groupTableNames.sort(compareStringsAsc)) {
                    text.push(tableName, 1);
                }
                text.push(`}`);
                text.push(``);
            }
        }
    }

    return text.stringify();
}

function generateTable(
    info: SchemaDefinitionInfoForType,
    options: DBMLGeneratorOptions,
    dereferencedRootSchema: Schema,
): TableSpec | undefined {
    const includeNotes = options.includeNotes ?? false;
    const entityTypeName = info.type;
    const columnsOrder = options.columnsOrder || DefaultColumnsOrder;
    const entitySchema = (dereferencedRootSchema.definitions || dereferencedRootSchema.$defs)?.[
        entityTypeName
    ];
    if (!entitySchema) return;
    if (typeof entitySchema !== 'object')
        raise(`Invalid definition type for table: ${typeof entitySchema} (expected object)`);

    const tableName = readDBEntityName(entitySchema);
    if (!tableName) return;

    const { properties, required } = listProperties(entitySchema);
    const columns = generateColumns(
        properties,
        required,
        includeNotes,
        info.schemaId,
        tableName,
        columnsOrder,
    );
    const indexes = generateIndexes(
        tableName,
        properties,
        readDBEntityIndexes(entitySchema),
        includeNotes,
        info.schemaId,
    );

    const text = new TextBuilder();

    if (entitySchema.$comment) {
        text.push(stringifyComment(entitySchema.$comment));
    }

    text.push(`Table ${tableName} {`);
    text.push(columns, 1);

    if (indexes.size) {
        text.push('');
        text.push('indexes {', 1);
        text.push(indexes, 2);
        text.push('}', 1);
    }

    if (entitySchema.description) {
        text.push('');
        text.push(buildNote(entitySchema.description), 1);
    }

    text.push('}');

    return {
        name: tableName,
        value: text.stringify(),
    };
}

function generateColumns(
    properties: PRec<ForgedPropertySchema>,
    requiredFields: string[],
    notes: boolean,
    schemaId: string,
    tableName: string,
    columnsOrder: string[],
): TextBuilder {
    const text = new TextBuilder();
    let count = 0;

    for (const [key, property] of entries(properties).sort(([keyA], [keyB]) => {
        const indexA = columnsOrder.indexOf(keyA);
        const indexB = columnsOrder.indexOf(keyB);
        if (indexA === -1 && indexB === -1) return 0;
        else if (indexA === -1) return 1;
        else if (indexB === -1) return -1;

        return indexA - indexB;
    })) {
        if (property === undefined) continue;

        const isRequired = requiredFields.includes(key);
        const isColumnNullable = isNullable(property);
        const columnType = getDBType(property, schemaId);
        const attributes = generateColumnAttributes(
            key,
            property,
            isRequired,
            isColumnNullable,
            notes,
        );

        if (property.$comment) text.push(stringifyComment(property.$comment));
        const attributesText = attributes.stringify(', ');
        const hasLineBreak = attributesText.includes('\n');

        text.push(`${snakeCase(key)} ${columnType} [${attributesText}${hasLineBreak ? '\n' : ']'}`);
        hasLineBreak && text.push(']');
        count++;
    }

    if (count === 0) {
        raise(`Table ${tableName} (${schemaId}) does not have any columns defined`);
    }

    return text;
}

function generateColumnAttributes(
    _key: string,
    property: ForgedPropertySchema,
    isRequired: boolean,
    isColumnNullable: boolean,
    notes: boolean,
): TextBuilder {
    const result = new TextBuilder();

    const isPK = property.dbColumn?.pk ?? false;

    if (isPK) {
        result.push('pk');
    }

    const defaultValue = property.default;
    const hasDefaultValue = defaultValue !== undefined;

    if (isColumnNullable && isRequired) {
        if (!hasDefaultValue) result.push('default: null');
        // result.push('null'); <- by default
    } else if (isColumnNullable || !isRequired) {
        result.push('null');
    } else {
        result.push('not null');
    }

    if (hasDefaultValue) {
        const v =
            typeof defaultValue === 'string' &&
            defaultValue[0] !== '`' &&
            defaultValue[defaultValue.length - 1] !== '`'
                ? `"${defaultValue}"`
                : defaultValue;
        result.push(`default: ${String(v)}`);
    }

    if (notes && property.description) {
        result.push(buildNote(property.description, 2).stringify());
    }
    return result;
}

function generateIndexes(
    tableName: string,
    schemaProperties: PRec<ForgedPropertySchema>,
    entityIndexes: DBMLEntityOptions['indexes'],
    includeNotes: boolean,
    schemaId: string,
): TextBuilder {
    const text = new TextBuilder();
    const idx: PRec<
        {
            columnType: string;
            columns: string[];
            fields: string[];
        } & DBMLIndexOptions
    > = {};
    const normalizedTableName = tableName.replace(/\./g, '_');
    const dropIndexes = new Set<string>();

    function processIndex(
        source: DBMLIndexOptionsDef,
        column: string,
        key?: string,
        rawKey?: string,
    ) {
        if (!key) key = column;
        if (!rawKey) rawKey = key;
        const list = asArray(source);

        for (const item of list) {
            let indexName;

            if (typeof item === 'string') {
                indexName = item;
            } else if (item === true) {
                indexName = `ix_${normalizedTableName}_${key}`;
            } else if (item != null && typeof item === 'object') {
                if (item.name) {
                    indexName = item.name;
                } else {
                    const k = list.length === 1 ? key : `${key}_${item.type ?? 'btree'}`;
                    indexName = `ix_${normalizedTableName}_${k}`;
                }
            }

            if (indexName) {
                if (item === false) {
                    dropIndexes.add(indexName);
                } else {
                    if (!schemaProperties[column]) raise('`Column ${column} not found in schema`');

                    const field = substr(rawKey, '.');
                    const index = (idx[indexName] ||= {
                        ...(typeof item === 'object' ? item : {}),
                        columnType: getDBType(schemaProperties[column], schemaId),
                        columns: [],
                        fields: [],
                    });
                    if (field) index.fields.push(field);
                    index.columns.push(column);
                }
            }
        }
    }

    if (entityIndexes) {
        for (const [key, def] of Object.entries(entityIndexes)) {
            const prefix = substr(key, 0, '.');
            const column = prefix ? prefix : key;
            processIndex(
                //
                def,
                column,
                prefix ? key.replace(/\./g, '_') : key,
                key,
            );
        }
    }

    for (const [column, property] of Object.entries(schemaProperties)) {
        if (property?.dbIndex !== undefined) {
            processIndex(property.dbIndex, column);
        }
    }

    for (const [indexName, index] of entries(idx)) {
        if (!index) continue;
        const { columns, unique, pk, comment, note } = index;

        if (columns.length !== new Set(columns).size) {
            console.warn(`Duplicate columns in index ${indexName} for table ${tableName}`);
        }

        const options = new TextBuilder(`name: "${indexName}"`);

        const type =
            index.type || index.columnType === 'jsonb' || index.columnType.endsWith('[]')
                ? 'gin'
                : undefined;
        if (type) options.push(`type: ${type}`);
        if (pk) options.push(`pk`);
        if (!pk && unique) options.push('unique');
        // todo?
        // if (includeNotes && fields.length) {
        //     options.push(`note: 'Fields: ${fields.join(', ')};'`);
        // }
        if (includeNotes && note) options.push(buildNote(note, 3).stringify());
        if (comment) text.push(`// ${comment}`);

        text.push(`(${columns.map(snakeCase).join(', ')}) [${options.stringify(', ')}]`);
    }

    return text;
}

function readDBEntityName({ dbEntity }: ForgedEntitySchema): string | undefined {
    if (dbEntity) {
        if (typeof dbEntity === 'string') return dbEntity;
        if (dbEntity.name) return dbEntity.name;
    }
    return undefined;
}

function readDBEntityIndexes({ dbEntity }: ForgedEntitySchema): DBMLEntityOptions['indexes'] {
    if (dbEntity != null && typeof dbEntity === 'object') {
        return dbEntity.indexes;
    }
    return undefined;
}

function stringifyComment(value: string | undefined): string[] | undefined {
    if (!value) return undefined;
    return value.split('\n').map((item) => `// ${item.trim()}`);
}

function buildNote(value: string | undefined, mlLevel = 1): TextBuilder {
    const result = new TextBuilder();
    if (value) {
        if (value.includes('\n')) {
            result.push(`note:`);
            result.push([`'''`, ...value.split('\n'), `'''`], mlLevel);
        } else {
            result.push(`note: "${value}"`);
        }
    }
    return result;
}

function isNullable(property: Schema): boolean {
    return (
        property.anyOf?.some((item) => typeof item !== 'boolean' && item?.type !== 'null') ?? false
    );
}

let DereferenceSchemaCache: SchemaDereferenceSharedCache | undefined;

function getDBType(property: ForgedPropertySchema, schemaId: string): string {
    if (property.dbColumn?.type) return property.dbColumn.type;

    let type = property.type as string | undefined;
    if (!type && property.$ref) {
        raise(`Type ${JSON.stringify(property)} (${schemaId}) was not dereferenced`);
    }
    if (type && Array.isArray(type)) {
        type = type.filter((item) => item !== 'null')[0] as string | undefined;
    }
    if (type && typeof type !== 'string') {
        raise(`Invalid SchemaTypeName value type (${typeof type}) (expected string)`);
    }

    const variants = property.anyOf || property.oneOf;

    if (variants) {
        const nonNullType = variants.find(
            (item) => typeof item !== 'boolean' && item?.type !== 'null',
        );
        if (nonNullType) {
            return typeof nonNullType === 'object'
                ? getDBType(nonNullType, schemaId)
                : nonNullType.toString();
        }
    }

    if (type === 'string') {
        if (property.format === 'date-time') {
            return 'timestamptz';
        }

        return property.format === 'uuid' ? 'uuid' : 'text';
    }

    if (type === 'object' || type === 'array') {
        return 'jsonb';
    }

    return type ?? 'jsonb';
}

function listProperties(schema: Schema): {
    type: 'object';
    properties: PRec<ForgedPropertySchema>;
    required: string[];
} {
    if (schema.properties) {
        return {
            type: 'object',
            properties: schema.properties as PRec<ForgedPropertySchema>,
            required: schema.required || [],
        };
    }

    if (schema.oneOf) {
        // todo oneOf
        raise(`Schema ${JSON.stringify(schema)} has oneOf, but not implemented yet`);
    }

    if (!schema.anyOf) {
        return {
            type: 'object',
            properties: {},
            required: [],
        };
    }

    const propertiesMap: PRec<ForgedPropertySchema> = {};
    const requiredSet = new Set<string>();
    const initialized = false;

    for (const item of schema.anyOf) {
        if (typeof item !== 'object') continue;
        if (item.type !== 'object') continue;
        if (typeof item.properties !== 'object') continue;

        if (!initialized) {
            for (const name of Object.keys(item.properties)) {
                propertiesMap[name] = item.properties[name] as ForgedPropertySchema;
            }
            for (const name of item.required || []) {
                requiredSet.add(name);
            }
        } else {
            if (!isEqualKeys(propertiesMap, item.properties)) {
                console.warn('Properties are not identical across all members of anyOf');
            }
            for (const name of item.required || []) {
                if (!requiredSet.has(name)) {
                    console.warn('Required fields are not identical across all members of anyOf');
                }
            }
        }
    }

    return {
        type: 'object',
        properties: propertiesMap,
        required: Array.from(requiredSet),
    };
}

const DefaultScopeName = 'Default';
const DefaultColumnsOrder = ['id', 'uid', 'slug', 'name'];

type TableSpec = {
    name: string;
    value: string;
};

// todo escape notes!
// todo escape comments!
