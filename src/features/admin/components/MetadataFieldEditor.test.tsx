import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MetadataFieldEditor } from "./MetadataFieldEditor"

describe("metadata field editor", () => {
  it("preserves the existing document-type option contract", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    const value = "V".repeat(120)
    render(
      <MetadataFieldEditor
        field={{
          key: "loai_van_ban",
          label: "Loại văn bản",
          kind: "system",
          loai_van_ban_options: [{ value }],
        }}
        inSet={false}
        busy={false}
        onSave={save}
        onCancel={vi.fn()}
      />
    )
    fireEvent.click(
      screen.getByRole("checkbox", { name: "Cập nhật danh sách loại văn bản" })
    )
    fireEvent.click(screen.getByRole("button", { name: "Lưu trường" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          loai_van_ban_options: [{ value, description: "" }],
        })
      )
    )
  })

  it("creates a custom DROPLIST with coded values and labels", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <MetadataFieldEditor
        inSet
        busy={false}
        onSave={save}
        onCancel={vi.fn()}
      />
    )
    fireEvent.change(screen.getByRole("textbox", { name: "Key" }), {
      target: { value: "muc_do_uu_tien" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Tên hiển thị" }), {
      target: { value: "Mức ưu tiên" },
    })
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mô tả trích xuất" }),
      { target: { value: "Trích mức ưu tiên." } }
    )
    fireEvent.change(screen.getByRole("combobox", { name: "Kiểu dữ liệu" }), {
      target: { value: "DROPLIST" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Thêm lựa chọn" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Value" }), {
      target: { value: "HIGH" },
    })
    fireEvent.change(
      screen.getAllByRole("textbox", { name: "Tên hiển thị" })[1],
      { target: { value: "Cao" } }
    )
    fireEvent.click(screen.getByRole("button", { name: "Lưu trường" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "muc_do_uu_tien",
          kind: "custom",
          data_type: "DROPLIST",
          options: [{ value: "HIGH", label: "Cao", description: "" }],
        })
      )
    )
  })

  it("limits system field edits inside a set to label", async () => {
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <MetadataFieldEditor
        field={{
          key: "so_hieu_tai_lieu",
          label: "Số hiệu",
          kind: "system",
          description: "Locked",
        }}
        inSet
        busy={false}
        onSave={save}
        onCancel={vi.fn()}
      />
    )
    expect(screen.getByRole("textbox", { name: "Key" })).toBeDisabled()
    expect(
      screen.queryByRole("textbox", { name: "Mô tả trích xuất" })
    ).not.toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "Tên hiển thị" }), {
      target: { value: "Số văn bản" },
    })
    fireEvent.click(screen.getByRole("button", { name: "Lưu trường" }))
    await waitFor(() =>
      expect(save).toHaveBeenCalledWith({ label: "Số văn bản" })
    )
  })
})
