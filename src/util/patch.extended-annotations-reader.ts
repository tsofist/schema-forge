import { raise } from '@tsofist/stem/lib/error';
import { isEmptyObject } from '@tsofist/stem/lib/object/is-empty';
import { Annotations, ExtendedAnnotationsReader } from 'ts-json-schema-generator';
import {
    isIdentifier,
    isIntersectionTypeNode,
    isTypeAliasDeclaration,
    isTypeReferenceNode,
    isUnionTypeNode,
    Node,
    SymbolFlags,
    TypeChecker,
} from 'typescript';
import { hasJSDocTag } from './tsc';

{
    // Support for @inheritDoc tag to enforce inheritance of annotations

    const getAnnotations = ExtendedAnnotationsReader.prototype.getAnnotations;

    ExtendedAnnotationsReader.prototype.getAnnotations = function getAnnotationsWithInheritance(
        node: Node,
    ): Annotations | undefined {
        if (!hasJSDocTag(node, 'inheritDoc')) return getAnnotations.call(this, node);

        const checker =
            ((this as any).typeChecker as TypeChecker) || raise('TypeChecker is not available');
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
            if (symbol && symbol.declarations?.length) {
                for (const declaration of symbol.declarations) {
                    const ann = getAnnotations.call(this, declaration);
                    if (ann) Object.assign(inheritedAnn, ann);
                }
            }

            Object.assign(result, inheritedAnn);
        }

        {
            const ann = getAnnotations.call(this, node);
            if (ann) Object.assign(result, ann);
        }

        return isEmptyObject(result) ? undefined : result;
    };
}
