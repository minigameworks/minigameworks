import {
    FieldObjectDefinition,
    LevelDefinition,
    SurfaceLineObjectDefinition,
    SurfaceMaterial,
    SurfaceMaterialSection,
    TerrainObjectDefinition,
} from './LevelDefinitions';

type TiledPropertyValue = string | number | boolean;

type TiledProperty = {
    name: string;
    value: TiledPropertyValue;
};

type TiledPoint = {
    x: number;
    y: number;
};

type TiledSurfaceLineSegment = {
    points: [TiledPoint, TiledPoint];
    normal: TiledPoint;
};

type TiledObject = {
    id: number;
    name: string;
    type?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    rotation?: number;
    polygon?: TiledPoint[];
    properties?: TiledProperty[];
};

type TiledObjectLayer = {
    name: string;
    type: 'objectgroup';
    objects: TiledObject[];
};

type TiledTileChunk = {
    x: number;
    y: number;
    width: number;
    height: number;
    data: number[];
};

type TiledTileLayer = {
    name: string;
    type: 'tilelayer';
    width?: number;
    height?: number;
    data?: number[];
    chunks?: TiledTileChunk[];
};

type TiledLayer = TiledObjectLayer | TiledTileLayer;

export type TiledLevelMap = {
    width: number;
    height: number;
    tilewidth: number;
    tileheight: number;
    layers: TiledLayer[];
};

export const INITIAL_VERTICAL_MAP_KEY = 'initial-vertical-map';
export const INITIAL_VERTICAL_MAP_PATH = 'assets/tilemaps/initial-vertical.tmj';

export const createLevelFromTiledMap = (map: TiledLevelMap): LevelDefinition => {
    const metadataLayer = getTiledObjectLayer(map, 'metadata');
    const markersLayer = getTiledObjectLayer(map, 'markers');
    const surfacesLayer = getTiledObjectLayer(map, 'surfaces');
    const terrainLayer = getOptionalTiledTileLayer(map, 'terrain');
    const fieldObject = getTiledObjectByType(metadataLayer, 'field');
    const startObject = getTiledObjectByType(markersLayer, 'playerStart');
    const field: FieldObjectDefinition = {
        id: getRequiredTiledObjectName(fieldObject),
        kind: 'field',
        name: getStringProperty(fieldObject, 'label') ?? getRequiredTiledObjectName(fieldObject),
        width: fieldObject.width ?? map.width * map.tilewidth,
        height: fieldObject.height ?? map.height * map.tileheight,
        wallThickness: getNumberProperty(fieldObject, 'wallThickness') ?? 24,
    };

    return {
        key: getStringProperty(fieldObject, 'levelKey') ?? 'initial-vertical',
        name: getStringProperty(fieldObject, 'levelName') ?? '초기 수직 맵',
        startPosition: {
            x: startObject.x,
            y: startObject.y,
        },
        objects: [
            field,
            ...(terrainLayer ? [createTerrainObjectFromTiledLayer(map, terrainLayer)] : []),
            ...surfacesLayer.objects
                .filter((object) => !object.type || object.type === 'surface')
                .flatMap((object) => createSurfaceObjectsFromTiledObject(object, field)),
        ],
    };
};

const createTerrainObjectFromTiledLayer = (
    map: TiledLevelMap,
    layer: TiledTileLayer,
): TerrainObjectDefinition => {
    const tileSize = getSquareTileSize(map);
    const grid = createTerrainGrid(map, layer);

    return {
        id: 'initial-terrain',
        kind: 'terrain',
        name: '초기 맵 타일 지형',
        x: grid.x * tileSize,
        y: grid.y * tileSize,
        tileSize,
        columns: grid.columns,
        rows: grid.rows,
        tiles: grid.tiles,
        material: 'default',
    };
};

const createSurfaceObjectsFromTiledObject = (
    object: TiledObject,
    field: FieldObjectDefinition,
): SurfaceLineObjectDefinition[] => {
    if (object.polygon) {
        return createSurfaceLineObjectsFromTiledPolygon(object, field, object.polygon);
    }

    const rectanglePolygon = getRectangleSurfacePolygon(object);

    return rectanglePolygon
        ? createSurfaceLineObjectsFromTiledPolygon(object, field, rectanglePolygon)
        : [];
};

const createSurfaceLineObjectsFromTiledPolygon = (
    object: TiledObject,
    field: FieldObjectDefinition,
    polygon: TiledPoint[],
): SurfaceLineObjectDefinition[] => {
    const polygonSurfaceEdges = getPolygonSurfaceEdges(object, field, polygon);

    return polygonSurfaceEdges.map((edge, index) =>
        createSurfaceLineObjectFromTiledPoints(
            object,
            field,
            edge.points,
            index,
            polygonSurfaceEdges.length,
            index === 0 ? polygon : undefined,
            edge.normal,
        ),
    );
};

const getRectangleSurfacePolygon = (object: TiledObject): TiledPoint[] | undefined => {
    const width = object.width ?? 0;
    const height = object.height ?? 0;

    if (width <= 0 || height <= 0) {
        return undefined;
    }

    return [
        { x: 0, y: 0 },
        { x: width, y: 0 },
        { x: width, y: height },
        { x: 0, y: height },
    ];
};

const getPolygonSurfaceEdges = (
    object: TiledObject,
    field: FieldObjectDefinition,
    polygon: TiledPoint[],
): TiledSurfaceLineSegment[] => {
    if (polygon.length < 2) {
        return [];
    }

    const closedPolygonEdges = polygon.flatMap((point, index) => {
        const nextPoint = polygon[(index + 1) % polygon.length];

        return nextPoint ? [{ start: point, end: nextPoint }] : [];
    });
    const worldPolygon = polygon.map((point) => ({
        x: object.x + point.x,
        y: object.y + point.y,
    }));
    const snappedWorldPolygon = worldPolygon.map((point) =>
        snapSurfaceLinePointToFieldBounds(point, field),
    );
    const polygonCenter = getPolygonCenter(snappedWorldPolygon);

    return closedPolygonEdges
        .map((edge) => ({
            ...edge,
            worldStart: {
                x: object.x + edge.start.x,
                y: object.y + edge.start.y,
            },
            worldEnd: {
                x: object.x + edge.end.x,
                y: object.y + edge.end.y,
            },
            snappedWorldStart: snapSurfaceLinePointToFieldBounds(
                {
                    x: object.x + edge.start.x,
                    y: object.y + edge.start.y,
                },
                field,
            ),
            snappedWorldEnd: snapSurfaceLinePointToFieldBounds(
                {
                    x: object.x + edge.end.x,
                    y: object.y + edge.end.y,
                },
                field,
            ),
            length: Math.hypot(edge.end.x - edge.start.x, edge.end.y - edge.start.y),
            horizontalDelta: Math.abs(edge.end.x - edge.start.x),
            verticalDelta: Math.abs(edge.end.y - edge.start.y),
        }))
        .filter(
            (edge) =>
                edge.length > 0 &&
                !isSurfaceEdgeOnFieldBoundary(edge.worldStart, edge.worldEnd, field),
        )
        .map((edge) => ({
            points: [edge.start, edge.end],
            normal: getEdgeNormalAwayFromPoint(
                edge.snappedWorldStart,
                edge.snappedWorldEnd,
                polygonCenter,
            ),
        }));
};

const getPolygonCenter = (polygon: TiledPoint[]): TiledPoint => {
    const sum = polygon.reduce(
        (currentSum, point) => ({
            x: currentSum.x + point.x,
            y: currentSum.y + point.y,
        }),
        { x: 0, y: 0 },
    );

    return {
        x: sum.x / polygon.length,
        y: sum.y / polygon.length,
    };
};

const getEdgeNormalAwayFromPoint = (
    start: TiledPoint,
    end: TiledPoint,
    point: TiledPoint,
): TiledPoint => {
    const tangent = normalizeVector({
        x: end.x - start.x,
        y: end.y - start.y,
    });
    const normalA = { x: tangent.y, y: -tangent.x };
    const normalB = { x: -tangent.y, y: tangent.x };
    const edgeCenter = {
        x: (start.x + end.x) / 2,
        y: (start.y + end.y) / 2,
    };
    const awayVector = {
        x: edgeCenter.x - point.x,
        y: edgeCenter.y - point.y,
    };
    const normalAProjection = normalA.x * awayVector.x + normalA.y * awayVector.y;
    const normalBProjection = normalB.x * awayVector.x + normalB.y * awayVector.y;

    return normalAProjection >= normalBProjection ? normalA : normalB;
};

const isSurfaceEdgeOnFieldBoundary = (
    start: TiledPoint,
    end: TiledPoint,
    field: FieldObjectDefinition,
): boolean => {
    const tolerance = 12;
    const leftWallRightX = field.wallThickness;
    const rightWallLeftX = field.width - field.wallThickness;
    const groundTopY = field.height - field.wallThickness;
    const isOnVerticalBoundary =
        (start.x <= leftWallRightX + tolerance && end.x <= leftWallRightX + tolerance) ||
        (start.x >= rightWallLeftX - tolerance && end.x >= rightWallLeftX - tolerance);
    const isOnGroundBoundary = start.y >= groundTopY - tolerance && end.y >= groundTopY - tolerance;

    return isOnVerticalBoundary || isOnGroundBoundary;
};

const createSurfaceLineObjectFromTiledPoints = (
    object: TiledObject,
    field: FieldObjectDefinition,
    points: [TiledPoint, TiledPoint],
    index: number,
    segmentCount: number,
    colliderPoints: TiledPoint[] | undefined,
    normal: TiledPoint,
): SurfaceLineObjectDefinition => {
    const materialSectionsProperty = getStringProperty(object, 'surfaceSections');
    const [point, nextPoint] = points;
    const start = snapSurfaceLinePointToFieldBounds(
        {
            x: object.x + point.x,
            y: object.y + point.y,
        },
        field,
    );
    const end = snapSurfaceLinePointToFieldBounds(
        {
            x: object.x + nextPoint.x,
            y: object.y + nextPoint.y,
        },
        field,
    );
    const colliderVertices = colliderPoints?.map((colliderPoint) =>
        snapSurfaceLinePointToFieldBounds(
            {
                x: object.x + colliderPoint.x,
                y: object.y + colliderPoint.y,
            },
            field,
        ),
    );
    return {
        id:
            segmentCount === 1
                ? getTiledObjectFallbackName(object, 'surface')
                : `${getTiledObjectFallbackName(object, 'surface')}-${index + 1}`,
        kind: 'surface-line',
        name: getStringProperty(object, 'label') ?? getTiledObjectFallbackName(object, 'surface'),
        start,
        end,
        normal,
        material: getSurfaceMaterial(object),
        colliderVertices,
        surfaceSections: materialSectionsProperty
            ? parseSurfaceMaterialSections(object, materialSectionsProperty)
            : [],
    };
};

const snapSurfaceLinePointToFieldBounds = (
    point: TiledPoint,
    field: FieldObjectDefinition,
): TiledPoint => {
    const snapTolerance = 12;
    const leftWallRightX = field.wallThickness;
    const rightWallLeftX = field.width - field.wallThickness;
    const groundTopY = field.height - field.wallThickness;
    const snappedPoint = {
        x: point.x,
        y: point.y,
    };

    if (snappedPoint.x <= leftWallRightX + snapTolerance) {
        snappedPoint.x = leftWallRightX;
    }

    if (snappedPoint.x >= rightWallLeftX - snapTolerance) {
        snappedPoint.x = rightWallLeftX;
    }

    if (snappedPoint.y >= groundTopY - snapTolerance) {
        snappedPoint.y = groundTopY;
    }

    return snappedPoint;
};

const getTiledObjectFallbackName = (object: TiledObject, prefix: string): string =>
    object.name || `${prefix}-${object.id}`;

const normalizeVector = (vector: TiledPoint): TiledPoint => {
    const length = Math.hypot(vector.x, vector.y);

    if (length === 0) {
        return { x: 0, y: 0 };
    }

    return {
        x: vector.x / length,
        y: vector.y / length,
    };
};

const getTiledObjectLayer = (map: TiledLevelMap, name: string): TiledObjectLayer => {
    const layer = map.layers.find(
        (currentLayer): currentLayer is TiledObjectLayer =>
            currentLayer.name === name && currentLayer.type === 'objectgroup',
    );

    if (!layer) {
        throw new Error(`Tiled 맵에 '${name}' 오브젝트 레이어가 없다.`);
    }

    return layer;
};

const getOptionalTiledTileLayer = (map: TiledLevelMap, name: string): TiledTileLayer | undefined =>
    map.layers.find(
        (currentLayer): currentLayer is TiledTileLayer =>
            currentLayer.name === name && currentLayer.type === 'tilelayer',
    );

const getSquareTileSize = (map: TiledLevelMap): number => {
    if (map.tilewidth !== map.tileheight) {
        throw new Error('현재 Tiled terrain 레이어는 정사각 타일만 지원한다.');
    }

    return map.tilewidth;
};

const createTerrainGrid = (
    map: TiledLevelMap,
    layer: TiledTileLayer,
): {
    x: number;
    y: number;
    columns: number;
    rows: number;
    tiles: boolean[];
} => {
    if (layer.chunks && layer.chunks.length > 0) {
        return createTerrainGridFromChunks(layer.chunks);
    }

    const columns = layer.width ?? map.width;
    const rows = layer.height ?? map.height;
    const data = layer.data ?? [];

    return {
        x: 0,
        y: 0,
        columns,
        rows,
        tiles: Array.from({ length: columns * rows }, (_, index) => (data[index] ?? 0) > 0),
    };
};

const createTerrainGridFromChunks = (
    chunks: TiledTileChunk[],
): {
    x: number;
    y: number;
    columns: number;
    rows: number;
    tiles: boolean[];
} => {
    const minX = Math.min(...chunks.map((chunk) => chunk.x));
    const minY = Math.min(...chunks.map((chunk) => chunk.y));
    const maxX = Math.max(...chunks.map((chunk) => chunk.x + chunk.width));
    const maxY = Math.max(...chunks.map((chunk) => chunk.y + chunk.height));
    const columns = maxX - minX;
    const rows = maxY - minY;
    const tiles = Array.from({ length: columns * rows }, () => false);

    for (const chunk of chunks) {
        for (let row = 0; row < chunk.height; row += 1) {
            for (let column = 0; column < chunk.width; column += 1) {
                const sourceIndex = row * chunk.width + column;
                const targetColumn = chunk.x - minX + column;
                const targetRow = chunk.y - minY + row;
                const targetIndex = targetRow * columns + targetColumn;

                tiles[targetIndex] = (chunk.data[sourceIndex] ?? 0) > 0;
            }
        }
    }

    return {
        x: minX,
        y: minY,
        columns,
        rows,
        tiles,
    };
};

const getTiledObjectByType = (layer: TiledObjectLayer, type: string): TiledObject => {
    const object = layer.objects.find((currentObject) => currentObject.type === type);

    if (!object) {
        throw new Error(`Tiled 레이어 '${layer.name}'에 '${type}' 오브젝트가 없다.`);
    }

    return object;
};

const getRequiredTiledObjectName = (object: TiledObject): string => {
    if (!object.name) {
        throw new Error(`Tiled 오브젝트 ${object.id}에 name이 없다.`);
    }

    return object.name;
};

const getSurfaceMaterial = (object: TiledObject): SurfaceMaterial => {
    const material = getStringProperty(object, 'material') ?? 'default';

    if (material === 'default' || material === 'slippery') {
        return material;
    }

    throw new Error(`Tiled surface '${object.name}'의 material이 올바르지 않다.`);
};

const parseSurfaceMaterialSections = (
    object: TiledObject,
    rawValue: string,
): SurfaceMaterialSection[] => {
    const parsedValue: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
        throw new Error(`Tiled surface '${object.name}'의 surfaceSections가 배열이 아니다.`);
    }

    return parsedValue.map((section, index) => {
        if (!isSurfaceMaterialSection(section)) {
            throw new Error(
                `Tiled surface '${object.name}'의 surfaceSections[${index}] 형식이 올바르지 않다.`,
            );
        }

        return section;
    });
};

const isSurfaceMaterialSection = (value: unknown): value is SurfaceMaterialSection => {
    if (!value || typeof value !== 'object') {
        return false;
    }

    const section = value as Partial<SurfaceMaterialSection>;

    return (
        typeof section.id === 'string' &&
        typeof section.name === 'string' &&
        typeof section.startRatio === 'number' &&
        typeof section.endRatio === 'number' &&
        (section.material === 'default' || section.material === 'slippery')
    );
};

const getStringProperty = (object: TiledObject, name: string): string | undefined => {
    const value = getTiledPropertyValue(object, name);

    return typeof value === 'string' ? value : undefined;
};

const getNumberProperty = (object: TiledObject, name: string): number | undefined => {
    const value = getTiledPropertyValue(object, name);

    return typeof value === 'number' ? value : undefined;
};

const getTiledPropertyValue = (object: TiledObject, name: string): TiledPropertyValue | undefined =>
    object.properties?.find((property) => property.name === name)?.value;
