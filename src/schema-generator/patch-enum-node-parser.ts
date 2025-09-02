import { raise } from '@tsofist/stem/lib/error';
import {
    AnnotatedNodeParser,
    ChainNodeParser,
    EnumNodeParser,
    ExposeNodeParser,
    NodeParser,
    SubNodeParser,
} from 'ts-json-schema-generator';
import { EnumDeclaration, EnumMember, isEnumMember, TypeChecker } from 'typescript';
import { readJSDocDescription, readJSDocTagValue, readNodeName } from './helpers-tsc';

export function patchEnumNodeParser(
    root: NodeParser,
    checker: TypeChecker,
    meta: SFEnumMetadataMap,
    allowUseFallbackDescription: boolean | undefined,
) {
    const stack = (
        root as unknown as {
            childNodeParser: { nodeParsers: SubNodeParser[] };
        }
    ).childNodeParser.nodeParsers;

    const enumNodeParser = stack.find((parser: unknown) => {
        return (
            //
            parser instanceof ExposeNodeParser &&
            // @ts-expect-error It's a access-hack
            parser.subNodeParser instanceof AnnotatedNodeParser &&
            // @ts-expect-error It's a access-hack
            parser.subNodeParser.childNodeParser instanceof EnumNodeParser
        );
    }) as
        | (EnumNodeParser & {
              subNodeParser: {
                  childNodeParser: ChainNodeParser;
              };
          })
        | undefined;

    if (!enumNodeParser) {
        return raise(`Failed to patch EnumNodeParser, not found in stack`);
    }

    const originalCreateType = enumNodeParser.subNodeParser.childNodeParser.createType.bind(
        enumNodeParser.subNodeParser.childNodeParser,
    );

    enumNodeParser.subNodeParser.childNodeParser.createType = function PatchedCreateType(
        this: unknown,
    ) {
        // eslint-disable-next-line prefer-rest-params
        const node = arguments[0] as EnumDeclaration | EnumMember;
        const typeName = readNodeName(node);
        const result = originalCreateType.apply(
            this,
            // @ts-expect-error It's a access-hack
            // eslint-disable-next-line prefer-rest-params
            arguments,
        );
        const resultId = result.getId();

        if (isEnumMember(node)) {
            const memberValue = checker.getConstantValue(node);
            const memberName = readNodeName(node);
            const metaKey = `${resultId}.${String(memberValue)}`;
            const description = readJSDocDescription(node, allowUseFallbackDescription);
            const comment = readJSDocTagValue(node, 'comment');

            meta.set(metaKey, {
                typeName: readNodeName(node.parent),
                title: memberName,
                value: memberValue!,
                description,
                comment,
            });

            return result;
        } else {
            for (const member of node.members) {
                const memberValue = checker.getConstantValue(member);
                const memberName = readNodeName(member);
                const description = readJSDocDescription(member, allowUseFallbackDescription);
                const comment = readJSDocTagValue(member, 'comment');
                const metaKey = `${resultId}.${String(memberValue)}`;

                meta.set(metaKey, {
                    typeName,
                    title: memberName,
                    value: memberValue!,
                    description,
                    comment,
                });
            }

            return result;
        }
    };
}

export type SFEnumMetadata = {
    typeName: string;
    title: string;
    value: string | number;
    description: string | undefined;
    comment: string | undefined;
};

export type SFEnumMetadataMap = Map<string, SFEnumMetadata>;
