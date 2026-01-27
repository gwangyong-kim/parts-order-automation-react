"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import Modal, { ModalFooter } from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import { Spinner } from "@/components/ui/Spinner";

interface Product {
  id: number;
  productCode: string;
  productName: string;
  unit: string;
}

interface SalesOrderItem {
  id?: number;
  productId: number;
  productCode?: string;
  productName?: string;
  orderQty: number;
  notes: string | null;
}

interface SalesOrder {
  id?: number;
  orderNumber: string;
  division: string;
  manager: string;
  project: string;
  orderDate: string;
  deliveryDate: string;
  status: string;
  notes: string | null;
  items?: SalesOrderItem[];
}

interface SalesOrderFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: Partial<SalesOrder>) => void;
  initialData?: SalesOrder | null;
  isLoading?: boolean;
}

const statusOptions = [
  { value: "PENDING", label: "대기" },
  { value: "CONFIRMED", label: "확정" },
  { value: "IN_PRODUCTION", label: "생산중" },
  { value: "COMPLETED", label: "완료" },
  { value: "CANCELLED", label: "취소" },
];

export default function SalesOrderForm({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  isLoading = false,
}: SalesOrderFormProps) {
  const [formData, setFormData] = useState<Partial<SalesOrder>>({
    orderNumber: "",
    division: "",
    manager: "",
    project: "",
    orderDate: new Date().toISOString().split("T")[0],
    deliveryDate: "",
    status: "PENDING",
    notes: "",
  });

  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Fetch products on mount
  useEffect(() => {
    if (isOpen) {
      fetch("/api/products")
        .then((res) => res.json())
        .then((data) => {
          if (Array.isArray(data)) {
            setProducts(data);
          }
        })
        .catch((err) => console.error("Failed to fetch products:", err));
    }
  }, [isOpen]);

  useEffect(() => {
    if (initialData) {
      setFormData({
        orderNumber: initialData.orderNumber,
        division: initialData.division || "",
        manager: initialData.manager || "",
        project: initialData.project || "",
        orderDate: new Date(initialData.orderDate).toISOString().split("T")[0],
        deliveryDate: initialData.deliveryDate ? new Date(initialData.deliveryDate).toISOString().split("T")[0] : "",
        status: initialData.status,
        notes: initialData.notes || "",
      });
      // Load existing items
      if (initialData.items && initialData.items.length > 0) {
        setItems(initialData.items.map(item => ({
          id: item.id,
          productId: item.productId,
          productCode: item.productCode,
          productName: item.productName,
          orderQty: item.orderQty,
          notes: item.notes || "",
        })));
      } else {
        setItems([]);
      }
    } else {
      setFormData({
        orderNumber: "",
        division: "",
        manager: "",
        project: "",
        orderDate: new Date().toISOString().split("T")[0],
        deliveryDate: "",
        status: "PENDING",
        notes: "",
      });
      setItems([]);
    }
    setErrors({});
  }, [initialData, isOpen]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    // orderNumber is optional for new orders (auto-generated)
    // but required for editing
    if (initialData && !formData.orderNumber?.trim()) {
      newErrors.orderNumber = "수주번호를 입력해주세요.";
    }
    if (!formData.orderDate) {
      newErrors.orderDate = "수주일을 선택해주세요.";
    }
    if (items.length === 0) {
      newErrors.items = "최소 1개 이상의 제품을 추가해주세요.";
    }
    for (let i = 0; i < items.length; i++) {
      if (!items[i].productId) {
        newErrors[`item_${i}_product`] = "제품을 선택해주세요.";
      }
      if (!items[i].orderQty || items[i].orderQty <= 0) {
        newErrors[`item_${i}_qty`] = "수량을 입력해주세요.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onSubmit({
        ...formData,
        items: items,
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const addItem = () => {
    setItems([...items, { productId: 0, orderQty: 1, notes: "" }]);
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: keyof SalesOrderItem, value: string | number) => {
    const newItems = [...items];
    if (field === "productId") {
      const productId = Number(value);
      const product = products.find(p => p.id === productId);
      newItems[index] = {
        ...newItems[index],
        productId,
        productCode: product?.productCode,
        productName: product?.productName,
      };
    } else {
      newItems[index] = { ...newItems[index], [field]: value };
    }
    setItems(newItems);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={initialData ? "수주 수정" : "수주 등록"}
      size="xl"
    >
      <form onSubmit={handleSubmit}>
        {/* Header Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Input
            label={initialData ? "수주번호" : "수주번호 (선택)"}
            name="orderNumber"
            value={formData.orderNumber}
            onChange={handleChange}
            error={errors.orderNumber}
            required={!!initialData}
            placeholder={initialData ? "예: SO2501-0001" : "비워두면 자동 생성 (SO2601-0001)"}
          />
          <Input
            label="사업부"
            name="division"
            value={formData.division}
            onChange={handleChange}
            placeholder="담당 사업부"
          />
          <Input
            label="담당자"
            name="manager"
            value={formData.manager}
            onChange={handleChange}
            placeholder="영업 담당자"
          />
          <Input
            label="프로젝트"
            name="project"
            value={formData.project}
            onChange={handleChange}
            placeholder="프로젝트명"
          />
          <Input
            label="수주일"
            name="orderDate"
            type="date"
            value={formData.orderDate}
            onChange={handleChange}
            error={errors.orderDate}
            required
          />
          <Input
            label="납기일"
            name="deliveryDate"
            type="date"
            value={formData.deliveryDate}
            onChange={handleChange}
          />
          <Select
            label="상태"
            name="status"
            value={formData.status}
            onChange={handleChange}
            options={statusOptions}
          />
          <div className="md:col-span-2">
            <Textarea
              label="비고"
              name="notes"
              value={formData.notes || ""}
              onChange={handleChange}
              placeholder="추가 메모 사항"
              rows={2}
            />
          </div>
        </div>

        {/* Product Items Section */}
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-[var(--text-primary)]">제품 항목</h3>
            <button
              type="button"
              onClick={addItem}
              className="flex items-center gap-1 text-sm text-[var(--primary)] hover:text-[var(--primary-hover)]"
            >
              <Plus className="w-4 h-4" />
              제품 추가
            </button>
          </div>

          {errors.items && (
            <p className="text-sm text-[var(--danger)] mb-3">{errors.items}</p>
          )}

          {items.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-muted)] bg-[var(--gray-50)] rounded-lg">
              등록된 제품이 없습니다. &quot;제품 추가&quot; 버튼을 클릭하여 제품을 추가하세요.
            </div>
          ) : (
            <div className="space-y-3 max-h-60 overflow-y-auto">
              {items.map((item, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-[var(--gray-50)] rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      제품 선택
                    </label>
                    <select
                      value={item.productId || ""}
                      onChange={(e) => updateItem(index, "productId", e.target.value)}
                      className="input w-full text-sm"
                    >
                      <option value="">제품 선택...</option>
                      {products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.productCode} - {product.productName}
                        </option>
                      ))}
                    </select>
                    {errors[`item_${index}_product`] && (
                      <p className="text-xs text-[var(--danger)] mt-1">
                        {errors[`item_${index}_product`]}
                      </p>
                    )}
                  </div>
                  <div className="w-24">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      수량
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={item.orderQty}
                      onChange={(e) => updateItem(index, "orderQty", parseInt(e.target.value) || 0)}
                      className="input w-full text-sm"
                    />
                    {errors[`item_${index}_qty`] && (
                      <p className="text-xs text-[var(--danger)] mt-1">
                        {errors[`item_${index}_qty`]}
                      </p>
                    )}
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-[var(--text-secondary)] mb-1">
                      비고
                    </label>
                    <input
                      type="text"
                      value={item.notes || ""}
                      onChange={(e) => updateItem(index, "notes", e.target.value)}
                      placeholder="제품 비고"
                      className="input w-full text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="mt-6 p-1.5 text-[var(--danger)] hover:bg-[var(--danger)]/10 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
            disabled={isLoading}
          >
            취소
          </button>
          <button type="submit" className="btn-primary" disabled={isLoading}>
            {isLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" />
                저장 중...
              </span>
            ) : initialData ? (
              "수정"
            ) : (
              "등록"
            )}
          </button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
