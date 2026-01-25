import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { handleApiError } from "@/lib/api-error";
import { saveBulkUploadLog } from "@/lib/bulk-upload-logger";

export async function POST(request: Request) {
  try {
    const { data } = await request.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: "업로드할 데이터가 없습니다." },
        { status: 400 }
      );
    }

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[],
    };

    // 기존 창고 캐시
    const existingWarehouses = await prisma.warehouse.findMany({
      include: {
        zones: {
          include: {
            racks: true,
          },
        },
      },
    });
    const warehouseMap = new Map(
      existingWarehouses.map(w => [w.code.toUpperCase(), w])
    );

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowNum = i + 2; // Excel row (1-based + header)

      try {
        // 필드 매핑 (다양한 한글/영문 필드명 지원)
        const warehouseCode = (
          row["창고코드"] || row["warehouseCode"] || row["code"] || ""
        ).toString().trim().toUpperCase();
        const warehouseName = (
          row["창고명"] || row["warehouseName"] || row["name"] || ""
        ).toString().trim();
        const description = (
          row["설명"] || row["description"] || ""
        ).toString().trim();
        const address = (
          row["주소"] || row["address"] || ""
        ).toString().trim();
        const width = parseInt(row["너비"] || row["width"] || "100") || 100;
        const height = parseInt(row["높이"] || row["height"] || "100") || 100;

        // Zone 정보 (선택적)
        const zoneCode = (
          row["Zone코드"] || row["zoneCode"] || row["구역코드"] || ""
        ).toString().trim().toUpperCase();
        const zoneName = (
          row["Zone명"] || row["zoneName"] || row["구역명"] || ""
        ).toString().trim();
        const zoneColor = (
          row["Zone색상"] || row["zoneColor"] || row["색상"] || "#3B82F6"
        ).toString().trim();
        const zonePosX = parseInt(row["Zone X"] || row["zonePosX"] || "0") || 0;
        const zonePosY = parseInt(row["Zone Y"] || row["zonePosY"] || "0") || 0;
        const zoneWidth = parseInt(row["Zone 너비"] || row["zoneWidth"] || "20") || 20;
        const zoneHeight = parseInt(row["Zone 높이"] || row["zoneHeight"] || "20") || 20;

        // Rack 정보 (선택적)
        const rackRowNumber = (
          row["Rack번호"] || row["rackRowNumber"] || row["랙번호"] || ""
        ).toString().trim();
        const rackPosX = parseInt(row["Rack X"] || row["rackPosX"] || "0") || 0;
        const rackPosY = parseInt(row["Rack Y"] || row["rackPosY"] || "0") || 0;
        const shelfCount = parseInt(row["선반수"] || row["shelfCount"] || "4") || 4;

        // 필수 필드 검증
        if (!warehouseCode) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 창고코드는 필수입니다.`);
          continue;
        }

        // 창고 생성 또는 업데이트
        let warehouse = warehouseMap.get(warehouseCode);

        if (warehouse) {
          // 기존 창고 업데이트
          warehouse = await prisma.warehouse.update({
            where: { id: warehouse.id },
            data: {
              name: warehouseName || warehouse.name,
              description: description || warehouse.description,
              address: address || warehouse.address,
              width: width || warehouse.width,
              height: height || warehouse.height,
            },
            include: {
              zones: {
                include: {
                  racks: true,
                },
              },
            },
          });
          warehouseMap.set(warehouseCode, warehouse);
        } else if (warehouseName) {
          // 새 창고 생성
          warehouse = await prisma.warehouse.create({
            data: {
              code: warehouseCode,
              name: warehouseName,
              description: description || null,
              address: address || null,
              width,
              height,
            },
            include: {
              zones: {
                include: {
                  racks: true,
                },
              },
            },
          });
          warehouseMap.set(warehouseCode, warehouse);
        }

        if (!warehouse) {
          results.failed++;
          results.errors.push(`행 ${rowNum}: 창고를 찾을 수 없습니다. 창고명을 입력하여 새로 생성해주세요.`);
          continue;
        }

        // Zone 생성 또는 업데이트
        if (zoneCode) {
          const existingZone = warehouse.zones?.find(
            z => z.code.toUpperCase() === zoneCode
          );

          if (existingZone) {
            // 기존 Zone 업데이트
            await prisma.zone.update({
              where: { id: existingZone.id },
              data: {
                name: zoneName || existingZone.name,
                color: zoneColor || existingZone.color,
                posX: zonePosX,
                posY: zonePosY,
                width: zoneWidth,
                height: zoneHeight,
              },
            });

            // Rack 생성 또는 업데이트
            if (rackRowNumber) {
              const existingRack = existingZone.racks?.find(
                r => r.rowNumber === rackRowNumber
              );

              if (existingRack) {
                await prisma.rack.update({
                  where: { id: existingRack.id },
                  data: {
                    posX: rackPosX,
                    posY: rackPosY,
                    shelfCount,
                  },
                });
              } else {
                const newRack = await prisma.rack.create({
                  data: {
                    zoneId: existingZone.id,
                    rowNumber: rackRowNumber,
                    posX: rackPosX,
                    posY: rackPosY,
                    shelfCount,
                  },
                });

                // 선반 자동 생성
                const shelvesToCreate = [];
                for (let s = 1; s <= shelfCount; s++) {
                  shelvesToCreate.push({
                    rackId: newRack.id,
                    shelfNumber: s.toString().padStart(2, "0"),
                    capacity: 100,
                  });
                }
                await prisma.shelf.createMany({ data: shelvesToCreate });
              }
            }
          } else if (zoneName) {
            // 새 Zone 생성
            const newZone = await prisma.zone.create({
              data: {
                warehouseId: warehouse.id,
                code: zoneCode,
                name: zoneName,
                color: zoneColor,
                posX: zonePosX,
                posY: zonePosY,
                width: zoneWidth,
                height: zoneHeight,
              },
            });

            // Rack 생성
            if (rackRowNumber) {
              const newRack = await prisma.rack.create({
                data: {
                  zoneId: newZone.id,
                  rowNumber: rackRowNumber,
                  posX: rackPosX,
                  posY: rackPosY,
                  shelfCount,
                },
              });

              // 선반 자동 생성
              const shelvesToCreate = [];
              for (let s = 1; s <= shelfCount; s++) {
                shelvesToCreate.push({
                  rackId: newRack.id,
                  shelfNumber: s.toString().padStart(2, "0"),
                  capacity: 100,
                });
              }
              await prisma.shelf.createMany({ data: shelvesToCreate });
            }

            // 캐시 업데이트
            warehouse = await prisma.warehouse.findUnique({
              where: { id: warehouse.id },
              include: {
                zones: {
                  include: {
                    racks: true,
                  },
                },
              },
            }) ?? undefined;
            if (warehouse) {
              warehouseMap.set(warehouseCode, warehouse);
            }
          }
        }

        results.success++;
      } catch (err) {
        results.failed++;
        results.errors.push(`행 ${rowNum}: ${(err as Error).message}`);
      }
    }

    // 업로드 로그 저장
    try {
      await saveBulkUploadLog("WAREHOUSE" as never, results);
    } catch {
      // 로그 저장 실패 무시
    }

    return NextResponse.json({
      message: `업로드 완료: 성공 ${results.success}건, 실패 ${results.failed}건`,
      ...results,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
