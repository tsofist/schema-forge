import {
    type CompilerHost,
    type CompilerOptions,
    type Identifier,
    type JSDocTag,
    type MethodSignature,
    type NamedDeclaration,
    type Node,
    type PropertySignature,
    type SignatureDeclarationBase,
    SyntaxKind,
    getAllJSDocTags,
    getAllJSDocTagsOfKind,
    getJSDocCommentsAndTags,
    getTextOfJSDocComment,
    isInterfaceDeclaration,
    isJSDocUnknownTag,
    isTypeReferenceNode,
    resolveModuleName,
} from 'typescript';

export function readMemberTypeName(
    member: MethodSignature | PropertySignature | SignatureDeclarationBase,
): string | undefined {
    const type = member.type;

    if (type && isTypeReferenceNode(type)) {
        if (type.typeName.getText() !== 'Promise') {
            return type.getText();
        } else if (type.typeArguments) {
            return type.typeArguments[0].getText();
        }
        return 'unknown';
    }

    return type?.getText();
}

export function readJSDocDescription(
    node: Node,
    allowUseFallbackDescription: boolean | undefined,
    allowUseFallbackDescriptionFromParent = true,
): string | undefined {
    let value: string | undefined = undefined;
    let fallback: string | undefined = undefined;

    {
        const isTag = (tag: JSDocTag): tag is JSDocTag => {
            if (isJSDocUnknownTag(tag) && tag.tagName.escapedText === 'description') {
                value = getTextOfJSDocComment(tag.comment);
            }
            if (
                allowUseFallbackDescription &&
                allowUseFallbackDescriptionFromParent &&
                fallback === undefined &&
                tag.parent.kind === SyntaxKind.JSDoc &&
                tag.parent.comment
            ) {
                fallback = getTextOfJSDocComment(tag.parent.comment);
            }
            return (
                value !== undefined &&
                (!allowUseFallbackDescriptionFromParent || fallback !== undefined)
            );
        };
        getAllJSDocTags(node, isTag);
    }

    if (value === undefined && allowUseFallbackDescription && fallback === undefined) {
        const comment = getJSDocCommentsAndTags(node).find(
            (item) => item.kind === SyntaxKind.JSDoc && item.comment != null,
        )?.comment;
        if (comment) fallback = getTextOfJSDocComment(comment);
    }

    if (value === undefined && allowUseFallbackDescription && fallback !== undefined) {
        value = fallback;
    }

    return value;
}

export function readNodeName(node: NamedDeclaration): string {
    return (node.name as Identifier).escapedText + '';
}

export function readInterfaceGenericText(node: NamedDeclaration): string {
    if (isInterfaceDeclaration(node) && node.typeParameters?.length) {
        return `<${node.typeParameters[0].getText()}>`;
    }
    return '';
}

export function hasJSDocTag(statement: Node, tagName: string) {
    return (
        getAllJSDocTagsOfKind(statement, SyntaxKind.JSDocTag).find((tag) => {
            return tag.tagName.escapedText === tagName;
        }) != null
    );
}

export function resolveModuleFileName(
    containingFile: string,
    moduleName: string,
    compilerOptions: CompilerOptions,
    compilerHost: CompilerHost,
): string | undefined {
    const resolvedModule = resolveModuleName(
        moduleName,
        containingFile,
        compilerOptions,
        compilerHost,
    ).resolvedModule;
    return resolvedModule?.resolvedFileName;
}
