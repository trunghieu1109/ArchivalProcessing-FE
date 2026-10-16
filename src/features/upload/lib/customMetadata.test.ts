import { describe, expect, it } from "vitest"
import { customMetadataEntries } from "./customMetadata"

const snapshot = {
  metadata_config: {
    selected_fields: [
      "document_summary",
      "muc_do_uu_tien",
      "so_luong",
      "ghi_chu_rieng",
    ],
    custom_fields: ["muc_do_uu_tien", "so_luong", "ghi_chu_rieng"],
    field_labels: { so_luong: "Số lượng", ghi_chu_rieng: "Ghi chú riêng" },
    custom_field_definitions: [
      {
        key: "muc_do_uu_tien",
        label: "Mức độ ưu tiên lúc chốt batch",
        options: [{ value: "HIGH", label: "Cao" }],
      },
    ],
  },
}

describe("custom metadata display", () => {
  it("uses the bound snapshot for labels, options and selected fields", () => {
    expect(
      customMetadataEntries(
        [
          {
            document_summary: "Công văn",
            muc_do_uu_tien: "HIGH",
            truong_moi: "Không thuộc batch",
          },
          { so_luong: 0 },
        ],
        snapshot
      )
    ).toEqual([
      {
        key: "muc_do_uu_tien",
        label: "Mức độ ưu tiên lúc chốt batch",
        value: "Cao",
      },
      { key: "so_luong", label: "Số lượng", value: "0" },
      { key: "ghi_chu_rieng", label: "Ghi chú riêng", value: "" },
    ])
  })

  it("reads raw custom values even when normalized metadata only contains main fields", () => {
    expect(
      customMetadataEntries(
        [
          { document_summary: "Trích yếu" },
          { document_type: "Công văn" },
          { muc_do_uu_tien: "HIGH", so_luong: 12 },
        ],
        snapshot
      ).map((entry) => entry.value)
    ).toEqual(["Cao", "12", ""])
  })

  it("keeps explicit cleared values instead of restoring stale raw values", () => {
    const entries = customMetadataEntries(
      [
        { muc_do_uu_tien: null, ghi_chu_rieng: "" },
        { muc_do_uu_tien: "HIGH", ghi_chu_rieng: "Giá trị cũ" },
      ],
      snapshot
    )
    expect(entries[0].value).toBe("")
    expect(entries[2].value).toBe("")
  })

  it("excludes main aliases, diagnostics and transport fields without a snapshot", () => {
    expect(
      customMetadataEntries([
        {
          so_hieu_tai_lieu: "123/CV",
          so_cua_tai_lieu: "123",
          document_summary: "Trích yếu",
          summary: "Tóm tắt",
          mentioned_subjects: ["Đơn vị A"],
          signer: "Nguyễn A",
          data_path: "file.pdf",
          document_id: "doc-1",
          page_count: 12,
          _warnings: { issued_date: "missing" },
          _field_confidences: { muc_do_uu_tien: 1 },
          metadata_config: {},
          metadata_verified_by_name: "Admin",
          signature_status: "done",
          muc_do_uu_tien: "Cao",
          so_luong: 0,
          da_duyet: false,
          empty: "",
        },
      ])
    ).toEqual([
      { key: "muc_do_uu_tien", label: "muc do uu tien", value: "Cao" },
      { key: "so_luong", label: "so luong", value: "0" },
      { key: "da_duyet", label: "da duyet", value: "Không" },
    ])
  })

  it("prefers a document snapshot over the session snapshot", () => {
    expect(
      customMetadataEntries(
        [
          {
            muc_do_uu_tien: "HIGH",
            definition_snapshot: {
              metadata_config: {
                selected_fields: ["muc_do_uu_tien"],
                field_labels: { muc_do_uu_tien: "Nhãn của tài liệu nguồn" },
              },
            },
          },
        ],
        snapshot
      )
    ).toEqual([
      {
        key: "muc_do_uu_tien",
        label: "Nhãn của tài liệu nguồn",
        value: "HIGH",
      },
    ])
  })

  it("does not expose unconfigured values for a batch with only system fields", () => {
    expect(
      customMetadataEntries([{ muc_do_uu_tien: "HIGH" }], {
        metadata_config: {
          selected_fields: ["document_summary"],
          custom_fields: [],
        },
      })
    ).toEqual([])
  })

  it("formats arrays, booleans and objects without losing zero or false", () => {
    expect(
      customMetadataEntries([
        {
          custom_list: [0, false, "A"],
          custom_object: { note: "Ghi chú" },
        },
      ]).map((entry) => entry.value)
    ).toEqual(["0, Không, A", '{\n  "note": "Ghi chú"\n}'])
  })

  it("reads custom group definitions while excluding system definitions", () => {
    expect(
      customMetadataEntries([{ muc_do_uu_tien: "HIGH", system_extra: "ẩn" }], {
        metadata_config: {
          selected_fields: ["system_extra", "muc_do_uu_tien"],
        },
        group_field_definitions: [
          { key: "system_extra", kind: "system" },
          {
            key: "muc_do_uu_tien",
            kind: "custom",
            label: "Ưu tiên",
            options: [{ value: "HIGH", label: "Cao" }],
          },
        ],
      })
    ).toEqual([{ key: "muc_do_uu_tien", label: "Ưu tiên", value: "Cao" }])
  })
})
