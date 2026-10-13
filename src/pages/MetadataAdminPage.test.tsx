import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"

vi.mock("@/shared/config/featureFlags", () => ({
  DYNAMIC_METADATA_ENABLED: true,
  FONDS_MERGE_ENABLED: false,
}))
import { afterEach, describe, expect, it, vi } from "vitest"
import { MetadataAdminPage } from "./MetadataAdminPage"

const api = vi.hoisted(() => ({
  actor: { role: "admin" },
  fields: vi.fn(),
  sets: vi.fn(),
  mutate: vi.fn(),
}))
vi.mock("@/features/auth/lib/AuthContext", () => ({
  useAuth: () => ({ user: api.actor }),
}))
vi.mock("@/features/auth/components/UserMenu", () => ({ UserMenu: () => null }))
vi.mock("@/features/admin/api/metadataApi", () => ({
  listMetadataFields: api.fields,
  listMetadataSets: api.sets,
  mutateMetadata: api.mutate,
}))

afterEach(() => {
  vi.clearAllMocks()
  api.actor.role = "admin"
})

describe("admin metadata workflow", () => {
  it("creates an empty set then adds a custom field directly to the group", async () => {
    api.fields.mockResolvedValue([])
    api.sets.mockResolvedValue([])
    const group = {
      id: 13,
      name: "Bộ mới",
      field_keys: [] as string[],
      fields: [] as unknown[],
    }
    api.mutate.mockResolvedValue(group)
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Tạo bộ metadata" })
      ).toBeEnabled()
    )
    fireEvent.click(screen.getByRole("button", { name: "Tạo bộ metadata" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Tên bộ" }), {
      target: { value: "Bộ mới" },
    })
    api.sets.mockResolvedValue([group])
    fireEvent.click(screen.getByRole("button", { name: "Lưu bộ" }))
    await waitFor(() =>
      expect(api.mutate).toHaveBeenCalledWith("metadata-sets", "POST", {
        name: "Bộ mới",
        description: "",
      })
    )
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Thêm trường vào bộ" })
      ).toBeEnabled()
    )
    fireEvent.click(screen.getByRole("button", { name: "Thêm trường vào bộ" }))
    fireEvent.change(screen.getByRole("textbox", { name: "Key" }), {
      target: { value: "dia_diem" },
    })
    fireEvent.change(screen.getByRole("textbox", { name: "Tên hiển thị" }), {
      target: { value: "Địa điểm" },
    })
    fireEvent.change(
      screen.getByRole("textbox", { name: "Mô tả trích xuất" }),
      { target: { value: "Địa điểm trên tài liệu." } }
    )
    api.sets.mockResolvedValue([
      {
        ...group,
        field_keys: ["dia_diem"],
        fields: [{ key: "dia_diem", label: "Địa điểm", kind: "custom" }],
      },
    ])
    fireEvent.click(screen.getByRole("button", { name: "Lưu trường" }))
    await waitFor(() =>
      expect(api.mutate).toHaveBeenCalledWith(
        "metadata-sets/13/fields",
        "POST",
        expect.objectContaining({
          key: "dia_diem",
          kind: "custom",
          description: "Địa điểm trên tài liệu.",
          data_type: "TEXT",
        })
      )
    )
    expect(await screen.findByText("dia_diem")).toBeInTheDocument()
  })

  it("denies non-admins before loading metadata", () => {
    api.actor.role = "worker"
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    expect(screen.getByRole("alert")).toHaveTextContent("Chỉ admin")
    expect(api.fields).not.toHaveBeenCalled()
    expect(api.sets).not.toHaveBeenCalled()
  })

  it("keeps a failed library load distinct from an empty library and allows retry", async () => {
    api.fields.mockRejectedValue(new Error("tenant_id is required"))
    api.sets.mockResolvedValue([])
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không thể tải thư viện metadata"
    )
    expect(screen.queryByText("Chưa có bộ metadata")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tạo bộ metadata" })
    ).toBeDisabled()
    api.fields.mockResolvedValue([])
    fireEvent.click(screen.getByRole("button", { name: "Tải lại thư viện" }))
    expect(await screen.findByText("Chưa có bộ metadata")).toBeInTheDocument()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tạo bộ metadata" })
    ).toBeEnabled()
  })

  it("searches set names without accents and preserves the selected set", async () => {
    api.fields.mockResolvedValue([])
    api.sets.mockResolvedValue([
      { id: 12, name: "Tài liệu Đảng", field_keys: [], fields: [] },
      { id: 13, name: "Hồ sơ Tòa án", field_keys: [], fields: [] },
    ])
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    const first = await screen.findByRole("button", {
      name: "Mở bộ Tài liệu Đảng",
    })
    expect(first).toHaveAttribute("aria-pressed", "true")
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm bộ metadata" }), {
      target: { value: "toa an" },
    })
    expect(
      screen.queryByRole("button", { name: "Mở bộ Tài liệu Đảng" })
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Mở bộ Hồ sơ Tòa án" }))
    expect(
      screen.getByRole("heading", { name: "Hồ sơ Tòa án" })
    ).toBeInTheDocument()
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm bộ metadata" }), {
      target: { value: "" },
    })
    expect(
      screen.getByRole("button", { name: "Mở bộ Hồ sơ Tòa án" })
    ).toHaveAttribute("aria-pressed", "true")
  })

  it("copies only available pool fields and preserves the fields already in the set", async () => {
    const group = {
      id: 12,
      name: "Bộ hành chính",
      field_keys: ["so_hieu_tai_lieu"],
      fields: [{ key: "so_hieu_tai_lieu", label: "Số hiệu", kind: "system" }],
    }
    api.fields.mockResolvedValue([
      ...group.fields,
      { key: "dia_diem", label: "Địa điểm", kind: "custom" },
      { key: "noi_bo", label: "Nội bộ", kind: "custom", hidden: true },
    ])
    api.sets.mockResolvedValue([group])
    api.mutate.mockResolvedValue({})
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    fireEvent.click(
      await screen.findByRole("button", { name: "Sao chép từ kho" })
    )
    const dialog = screen.getByRole("dialog")
    const select = within(dialog).getByRole("combobox", {
      name: "Trường trong kho",
    })
    expect(
      within(select).queryByRole("option", { name: /Số hiệu/ })
    ).not.toBeInTheDocument()
    expect(
      within(select).queryByRole("option", { name: /Nội bộ/ })
    ).not.toBeInTheDocument()
    fireEvent.change(select, { target: { value: "dia_diem" } })
    fireEvent.click(
      within(dialog).getByRole("button", { name: "Sao chép trường" })
    )
    await waitFor(() =>
      expect(api.mutate).toHaveBeenCalledWith("metadata-sets/12", "PATCH", {
        field_keys: ["so_hieu_tai_lieu", "dia_diem"],
      })
    )
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
  })

  it("requires the deletion dialog confirmation and retains it when the API rejects deletion", async () => {
    const group = { id: 12, name: "Bộ hành chính", field_keys: [], fields: [] }
    api.fields.mockResolvedValue([])
    api.sets.mockResolvedValue([group])
    api.mutate.mockRejectedValue(new Error("Không thể xóa bộ đang sử dụng"))
    render(
      <MemoryRouter>
        <MetadataAdminPage />
      </MemoryRouter>
    )
    fireEvent.click(await screen.findByRole("button", { name: "Xóa bộ" }))
    const dialog = screen.getByRole("dialog")
    expect(api.mutate).not.toHaveBeenCalled()
    fireEvent.click(within(dialog).getByRole("button", { name: "Xóa bộ" }))
    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Không thể xóa bộ đang sử dụng"
    )
    expect(api.mutate).toHaveBeenCalledWith("metadata-sets/12", "DELETE")
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }))
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    )
    expect(
      screen.getByRole("button", { name: "Mở bộ Bộ hành chính" })
    ).toBeInTheDocument()
  })
})
