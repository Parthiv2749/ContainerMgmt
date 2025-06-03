import { useEffect, useState, useRef } from "react";
import { Camera, Video, Upload, Trash2, X } from "lucide-react";
import axios from "axios";
import TypableSelect from "../../UI/UXComponent/TypebleSelect";

function ReportForm({ editData, onSubmitSuccess }) {
  const [products, setProducts] = useState([
    { name: null, quantity: null, reason: null, files: [], previews: [] },
  ]);
  const [containers, setContainers] = useState([]);
  const [selectedContainer, setSelectedContainer] = useState("");
  const [originalData, setOriginalData] = useState(null); // For change detection
  const [appendedContainerId, setAppendedContainerId] = useState(null);
  const [removedDocIds, setRemovedDocIds] = useState([]);
  const [removedProductIds, setRemovedProductIds] = useState([]);


  // Fetch containers
  useEffect(() => {
    const fetchContainers = async () => {
      try {
        const response = await axios.get(
          `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/getAllContainers`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`,
            },
          }
        );

        const data = JSON.parse(response.data).data;

        if (Array.isArray(data)) {
          setContainers(data);
        } else {
          console.error("Unexpected container format", data);
          setContainers([]);
        }
      } catch (err) {
        console.error("Error fetching containers:", err);
      }
    };

    fetchContainers();
  }, []);

  // Load edit data and append container if missing
  useEffect(() => {

    if (!editData || containers.length === 0) return;

    const containerId = editData.containerId;
    const containerNumber = editData.container_number;
    
    // console.log(editData);
    const exists = containers.some(([id]) => id === containerId);
    if (!exists) {
      // console.log("EXIST");
      setContainers((prev) => [...prev, [containerId, containerNumber]]);
      setAppendedContainerId(containerId);
    }

    setSelectedContainer(containerId);

      // Map products and previews from editData
    const mappedProducts = editData.products.map((product) => ({
      name: product.name || "",
      quantity: product.quantity || "",
      reason: product.reason || "",
      files: [], // new files
      editProductId: product.id, // track for deletion
      previews:
        product.files?.map((doc) => ({
          id: doc.id,
          name: doc.filename || "file",
          url: `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/getReportImage/${doc.id}`,
          type: doc.filename?.match(/\.(mp4|webm|ogg)$/i) ? "video" : "image",
        })) || [],
    }));


    setProducts(mappedProducts);

      // Save original data snapshot for change detection
      setOriginalData({
        container_id: containerId,
        products: mappedProducts.map(({ name, quantity, reason, editProductId }) => ({
          id: editProductId,
          name,
          quantity,
          reason,
        })),
      });


    console.log("Product", products);

  }, [editData, containers]);

  // Detect changes by deep comparing current and original data (simple version)
  const isDataChanged = () => {
    if (!originalData) return true; // new report, always submit
    if (selectedContainer !== originalData.container_id) return true;
    if (products.length !== originalData.products.length) return true;

    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      const o = originalData.products[i];

      if (
        p.name !== o.name ||
        p.quantity !== o.quantity ||
        p.reason !== o.reason ||
        p.files.length > 0 // New files added
      ) {
        return true;
      }
    }

    if (removedDocIds.length > 0 || removedProductIds.length > 0) {
      return true;
    }

    return false;
  };

  const getChangedProducts = () => {
    if (!originalData) return products.map((p) => ({
      ...p.editProductId && { id: p.editProductId },
      name: p.name,
      quantity: p.quantity,
      reason: p.reason,
      ...(p.files.length > 0 && { files: p.files.map(() => "placeholder") }),
    }));

    return products.reduce((changed, currentProduct, i) => {
      const original = originalData.products.find(p => p.id === currentProduct.editProductId);
      if (!original && currentProduct.editProductId) return changed; // skip if not found

      let entry = { id: currentProduct.editProductId };
      let hasChange = false;

      if (currentProduct.name !== original?.name) {
        entry.name = currentProduct.name;
        hasChange = true;
      }

      if (currentProduct.quantity !== original?.quantity) {
        entry.quantity = currentProduct.quantity;
        hasChange = true;
      }

      if (currentProduct.reason !== original?.reason) {
        entry.reason = currentProduct.reason;
        hasChange = true;
      }

      if (currentProduct.files.length > 0) {
        entry.files = currentProduct.files.map(() => "placeholder");
        hasChange = true;
      }

      if (hasChange) changed.push(entry);
      return changed;
    }, []);
  };


  const isProductChanged = (product, original) => {
    return (
      product.name !== original.name ||
      product.quantity !== original.quantity ||
      product.reason !== original.reason ||
      product.files.length > 0
    );
  };
 
  
  // Handle form input changes
  const handleChange = (index, field, value) => {
    const updated = [...products];
    updated[index][field] = value;
    setProducts(updated);
  };

  // File handling
  const handleRemoveFile = (productIndex, fileIndex) => {
    const updated = [...products];
    const preview = updated[productIndex].previews[fileIndex];

    if (preview.url?.startsWith("blob:")) {
      URL.revokeObjectURL(preview.url);
    } else if (preview.id) {
      // If it's an existing file, mark for deletion
      setRemovedDocIds((prev) => [...prev, preview.id]);
    }

    updated[productIndex].previews.splice(fileIndex, 1);
    updated[productIndex].files.splice(fileIndex, 1);
    setProducts(updated);
  };


  const handleFileChange = (index, files) => {
    const fileArray = Array.from(files);
    const updated = [...products];
    const existingFiles = updated[index].files || [];
    const existingPreviews = updated[index].previews || [];

    updated[index].files = [...existingFiles, ...fileArray];

    const newPreviews = fileArray.map((file) => ({
      url: URL.createObjectURL(file),
      type: file.type.startsWith("image") ? "image" : "video",
      name: file.name,  // <-- original file name here
    }));

    updated[index].previews = [...existingPreviews, ...newPreviews];
    setProducts(updated);
  };

  const addProduct = () => {
    setProducts([...products, { name: "", quantity: "", reason: "", files: [], previews: [] }]);
  };

  const removeProduct = (index) => {
    // console.log(index);
    const productToRemove = products[index];

    // Collect associated previews (non-blob) for deletion
    productToRemove.previews.forEach((preview) => {
      if (!preview.url?.startsWith("blob:") && preview.id) {
        setRemovedDocIds((prev) => [...prev, preview.id]);
      } else if (preview.url?.startsWith("blob:")) {
        URL.revokeObjectURL(preview.url);
      }
    });

    // console.log("Removed product ID:", productToRemove);

    // Track deleted product if it's from edit mode
    if (productToRemove.editProductId) {
      setRemovedProductIds((prev) => [...prev, productToRemove.editProductId]);
      console.log("Removed product ID:", productToRemove.editProductId);
    }

    setProducts(products.filter((_, i) => i !== index));
  };


  // Submit new report
  const submitNewReport = async (containerId, products) => {
    if (!containerId) throw new Error("Container ID is required");

    const formData = new FormData();

    const dataPayload = {
      container_id: containerId,
      products: products.map((product) => ({
        name: product.name,
        quantity: product.quantity,
        reason: product.reason,
        files: product.files.map(() => "placeholder"),
      })),
    };

    formData.append("data", JSON.stringify(dataPayload));

    products.forEach((product) => {
      product.files.forEach((file) => {
        formData.append("files", file);
      });
    });

    const url = `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/submitDamagedProducts`;

    const headers = {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };

    return axios.post(url, formData, { headers });
  };

  // Submit edited report - only changed data
  const submitEditReport = async (containerId, products, removeDocIds = [], removeProductIds = []) => {
    if (!containerId) throw new Error("Container ID is required");

    const formData = new FormData();

    // Filter changed products by comparing with original
    // const changedProducts = products
    //   .map((product, index) => {
    //     const original = originalData.products[index];
    //     if (!original || isProductChanged(product, original)) {
    //       return {
    //         name: product.name,
    //         quantity: product.quantity,
    //         reason: product.reason,
    //         files: product.files.map(() => "placeholder"),
    //         id: product.editProductId || undefined,
    //       };
    //     }
    //     return null;
    //   })
    //   .filter(Boolean);

    // if (
    //   changedProducts.length === 0 &&
    //   removeDocIds.length === 0 &&
    //   removeProductIds.length === 0
    // ) {
    //   alert("No changes to submit.");
    //   return;
    // }
    
    // console.log("Changed Products:", changedProducts);
    const changedProducts = getChangedProducts();
    const dataPayload = {
      container_id: selectedContainer,
      products: changedProducts,
      report_id: editData.report_id,
    };

    formData.append("data", JSON.stringify(dataPayload));

    // Add only new files of changed products
    changedProducts.forEach((changedProduct) => {
      const index = products.findIndex((p) => p.editProductId === changedProduct.id);
      if (index === -1) return;

      const product = products[index];
      product.files.forEach((file) => {
        formData.append("files", file);
      });
    });

    removeDocIds.forEach((id) => {
      formData.append("remove_doc_ids", id.toString());
    });
    removeProductIds.forEach((id) => {
      formData.append("remove_product_ids", id.toString());
    });

    const url = `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/updateDamagedProducts/${editData.report_id}`;
    const headers = {
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    };

    return axios.post(url, formData, { headers });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!selectedContainer) {
      alert("Please select a container.");
      return;
    }

    // Check if any changes made on edit mode
    if (editData && !isDataChanged()) {
      alert("No changes detected, nothing to submit.");
      return;
    }

    try {
      if (editData) {
        // Submit edits only
        await submitEditReport(selectedContainer, products, removedDocIds, removedProductIds);
        alert("Damage report updated!");
      } else {
        // Submit new report
        await submitNewReport(selectedContainer, products);
        alert("Damage report submitted!");
      }

      if (onSubmitSuccess) onSubmitSuccess();

      // Cleanup appended container on submit if any
      if (appendedContainerId) {
        setContainers((prev) => prev.filter(([id]) => id !== appendedContainerId));
        setAppendedContainerId(null);
      }
    } catch (error) {
      console.error("Submission failed:", error);
      alert("Failed to submit damage report.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-5xl mx-auto p-4 space-y-6">
      <h2 className="text-3xl font-bold text-red-600 text-center">
        {editData ? "Edit Damaged Product Report" : "New Damaged Product Report"}
      </h2>

      {/* Container Selector */}
      <div>
        <label className="block font-medium mb-2">Select Container</label>
        <TypableSelect
          options={containers.map(([id, number]) => ({
            id,
            name: number,
          }))}
          value={selectedContainer}
          onChange={setSelectedContainer}
          placeholder="Select or type to search"
        />
      </div>

      {/* Product Inputs */}
      {products.map((product, index) => (
        <div
          key={index}
          className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-4 shadow-sm"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <input
              type="text"
              placeholder="Product Name"
              value={product.name}
              onChange={(e) => handleChange(index, "name", e.target.value)}
              className="border px-3 py-2 rounded"
              required
            />
            <input
              type="number"
              placeholder="Quantity"
              value={product.quantity}
              onChange={(e) => handleChange(index, "quantity", e.target.value)}
              className="border px-3 py-2 rounded"
              required
            />
            <input
              type="text"
              placeholder="Reason"
              value={product.reason}
              onChange={(e) => handleChange(index, "reason", e.target.value)}
              className="border px-3 py-2 rounded"
            />
          </div>

          {/* File Upload */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            <div className="block sm:hidden">
              <label className="flex items-center gap-2 cursor-pointer">
                <Camera className="w-5 h-5" />
                <span>Take Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) => handleFileChange(index, e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="block sm:hidden">
              <label className="flex items-center gap-2 cursor-pointer">
                <Video className="w-5 h-5" />
                <span>Take Video</span>
                <input
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={(e) => handleFileChange(index, e.target.files)}
                  className="hidden"
                />
              </label>
            </div>

            <div className="col-span-2 sm:col-span-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <Upload className="w-5 h-5" />
                <span>Select Files</span>
                <input
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  onChange={(e) => handleFileChange(index, e.target.files)}
                  className="hidden"
                />
              </label>
              <p className="text-sm text-gray-500">
                {product.files.length} file(s) selected
              </p>
            </div>
          </div>

          {/* File Previews */}
          {product.previews && product.previews.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {product.previews.map((preview, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between border rounded p-2"
                >
                  <a
                    href={preview.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 underline break-words max-w-full overflow-hidden text-ellipsis whitespace-nowrap"
                    title={preview.name || `File ${i + 1}`}
                  >
                    {preview.name || `File ${i + 1}`}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleRemoveFile(index, i)}
                    className="ml-4 px-2 py-1  text-black rounded hover:bg-red-700"
                    aria-label="Remove file"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}




          {products.length > 1 && (
            <button
              type="button"
              onClick={() => removeProduct(index)}
              className="text-red-600 underline"
            >
              Remove Product
            </button>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={addProduct}
        className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700"
      >
        Add Product
      </button>

      <div className="flex justify-center mt-6">
        <button
          type="submit"
          className="px-6 py-3 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
        >
          {editData ? "Update Report" : "Submit Report"}
        </button>
      </div>
    </form>
  );
}

export default ReportForm;
