import { raise } from '@tsofist/stem/lib/error';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { Annotations, ExtendedAnnotationsReader, symbolAtNode } from 'ts-json-schema-generator';
import {
    isIdentifier,
    isIntersectionTypeNode,
    isTypeAliasDeclaration,
    isTypeReferenceNode,
    isUnionTypeNode,
    JSDocTagInfo,
    Node,
    SymbolFlags,
    TypeChecker,
} from 'typescript';
import { hasJSDocTag } from './helpers-tsc';

{
    // Support for @inheritDoc tag to enforce inheritance of annotations
    // todo rework

    // eslint-disable-next-line @typescript-eslint/unbound-method
    const getAnnotations = ExtendedAnnotationsReader.prototype.getAnnotations;

    ExtendedAnnotationsReader.prototype.getAnnotations = function getAnnotationsWithInheritance(
        node: Node,
    ): Annotations | undefined {
        const seeAnnotations = new Set<string>();
        collectSeeAnnotations(node, seeAnnotations);

        if (!hasJSDocTag(node, 'inheritDoc')) {
            const result = getAnnotations.call(this, node) ?? {};
            mergeSeeAnnotation(result, seeAnnotations);

            return isEmptyObject(result) ? undefined : result;
        }

        // @ts-expect-error access to private property
        const checker = (this.typeChecker as TypeChecker) || raise('TypeChecker is not available');
        const result: Annotations = {};

        if (
            !('ref' in result) &&
            !('$ref' in result) &&
            //
            isTypeAliasDeclaration(node) &&
            //
            isTypeReferenceNode(node.type) &&
            isIdentifier(node.type.typeName) &&
            !isUnionTypeNode(node.type) &&
            !isIntersectionTypeNode(node.type)
        ) {
            const alias = checker.getSymbolAtLocation(node.type.typeName);
            const symbol =
                alias && SymbolFlags.Alias & alias.flags
                    ? checker.getAliasedSymbol(alias)
                    : undefined;

            const inheritedAnn: Annotations = {};
            if (symbol?.declarations?.length) {
                for (const declaration of symbol.declarations) {
                    const ann = getAnnotations.call(this, declaration);
                    if (ann) {
                        collectSeeAnnotations(declaration, seeAnnotations);
                        Object.assign(inheritedAnn, ann);
                    }
                }
            }

            Object.assign(result, inheritedAnn);
        }

        {
            const inheritedAnn = getAnnotations.call(this, node);
            if (inheritedAnn) {
                Object.assign(result, inheritedAnn);
            }
        }

        mergeSeeAnnotation(result, seeAnnotations);

        return isEmptyObject(result) ? undefined : result;
    };

    function mergeSeeAnnotation(to: Annotations, values: Set<string>) {
        const result = Array.from(values);

        if (!result.length) {
            delete to['see'];
        } else {
            to['see'] = result.length === 1 ? result[0] : result;
        }
    }

    function collectSeeAnnotations(source: Node, to: Set<string>) {
        const symbol = symbolAtNode(source);

        if (symbol) {
            for (const { name, text: data } of symbol.getJsDocTags() as JSDocTagInfo[]) {
                const parts: string[] = [];
                if (data?.length && name === 'see') {
                    for (const { kind, text } of data) {
                        // kind: text space link linkText
                        if (!text || text === '*' || kind === 'link') {
                            continue;
                        }

                        parts.push(kind === 'space' ? ' ' : text.trimEnd());
                    }
                }

                if (parts.length) {
                    to.add(
                        parts
                            .join('')
                            .replace(/[^\S\r\n]+(\W)/, '$1')
                            .trimEnd(),
                    );
                }
            }
        }
    }
}
