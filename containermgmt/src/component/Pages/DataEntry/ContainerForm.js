import { useRef, useEffect, useState } from "react";
import axios from "axios";
import TypableSelect from "../../UI/UXComponent/TypebleSelect";
import { getAllOptions } from "./optionCache.js";



function ContainerEntryForm({editData, onSubmitSuccess, onFormSubmit }) {
  // console.log("ContainerEntryForm rendered with editData:", editData);
  const [formData, setFormData] = useState({
    container_id: "",
    consignee: "",
    poNo: "",
    supplier: "",
    shippingType: "",
    material: "",
    arrivalDate: "",
    arrivalTime: "",
    type: "",
    containerNo: "",
    inBound: "",
    emptyDate: "",
    outBound: "",
    unloadedAtDock: "",
    emptyAt: "",
    note: ""
  });
  const [originalData, setOriginalData] = useState({});
  const [documents, setDocuments] = useState([]);
  const fileInputRef = useRef(null);
  const [removedDocIds, setRemovedDocIds] = useState([]);

  const [suppliers, setSuppliers] = useState([]);
  const [consignees, setConsignees] = useState([]);
  const [emptyLocations, setEmptyLocations] = useState([]);
  const [status, setStatus] = useState([]);
  const [type, setType] = useState([]);
  const [shipping, setShipping] = useState([]);

  useEffect(() => {
    async function loadOptions() {
      const data = await getAllOptions();
      setSuppliers(data.suppliers);
      setConsignees(data.consignees);
      setEmptyLocations(data.emptyLocations);
      setStatus(data.status);
      setType(data.type);
      setShipping(data.shipping);
    }
    loadOptions();
  }, []);

  useEffect(() => {
    if (editData) {
      setFormData(prev => ({
        ...prev,
        ...editData,
        container_id: editData.Container_ID  // explicitly map backend key
      }));

      setOriginalData({
        ...editData,
        container_id: editData.Container_ID  // also update originalData if needed for change comparison
      });

      if (editData.documents) {
        const formattedDocs = editData.documents.map((doc) => ({
          isExisting: true,
          file_path: doc.path,
          id: doc.docs_id
        }));
        setDocuments(formattedDocs);
      }
    }
  }, [editData]);





  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddNewFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setDocuments((prev) => [...prev, { file }]);
    e.target.value = "";
  };

  const triggerFilePicker = () => {
    fileInputRef.current?.click();
  };

  const removeDocumentInput = (index) => {
    setDocuments((docs) => {
      const docToRemove = docs[index];
      if (docToRemove.isExisting && docToRemove.id) {
        setRemovedDocIds((prev) => [...prev, docToRemove.id]);
      }
      return docs.filter((_, i) => i !== index);
    });
  };


  const handleSubmit = async (e) => {
    e.preventDefault();

    // 1) Detect changes in form fields vs original data
    const changedFields = {};
    Object.entries(formData).forEach(([key, value]) => {
      if (originalData && value !== originalData[key]) {
        changedFields[key] = value;
      }
    });

    // 2) Detect if any document changes: new files or removed files
    const hasNewDocuments = documents.some(doc => doc.file);
    const hasRemovedDocuments = removedDocIds.length > 0;

    // If no changed fields AND no doc changes => nothing to update
    if (
      Object.keys(changedFields).length === 0 &&
      !hasNewDocuments &&
      !hasRemovedDocuments
    ) {
      alert("No update found");
      return; // Don't send request
    }

    // 3) Build form data payload
    const payload = new FormData();

    if (formData.container_id) {
      payload.append("container_id", formData.container_id);
    }

    // Append changed form fields only
    Object.entries(changedFields).forEach(([key, value]) => {
      payload.append(key, value);
    });

    // Append new documents if any
    documents.forEach(doc => {
      if (doc.file) {
        payload.append("documents", doc.file);
      }
    });

    // Append removed document IDs
    if (hasRemovedDocuments) {
      removedDocIds.forEach(id => payload.append("remove_doc_ids", id));
    }

    // 4) Decide URL - only update goes to updateContainerDetails
    console.log("Form data being submitted:", formData.container_id);
    const url = formData.container_id
      ? `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/updateContainerDetails/${formData.container_id}`
      : `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/setContainerDetails`;

    try {
      const response = await axios.post(url, payload, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
          "Content-Type": "multipart/form-data",
        },
      });

      // alert("Submitted successfully");
      if (onSubmitSuccess) onSubmitSuccess();

    } catch (error) {
      console.error("Submission error:", error);
      alert("Submission failed");
    }
    onFormSubmit();
  };


  const fields = [
    { label: "Container No", name: "container_no", type: "text" },
    { label: "Type", name: "type", type: "select", options: type },
    { label: "Arrival Date", name: "arrival_on_port", type: "date" },
    { label: "PO No", name: "PONo", type: "text" },
    { label: "Supplier", name: "supplier", type: "select", options: suppliers },
    { label: "Consignee", name: "consignee", type: "select", options: consignees },
    { label: "Shipping Type", name: "docs", type: "select", options: shipping },
    { label: "Tax", name: "tax", type: "checkbox" },
    { label: "Material", name: "material", type: "textarea" },
    { label: "Status", name: "status", type: "select", options: status },
    { label: "In Bound", name: "in_bound", type: "date" },
    { label: "Empty Date", name: "empty_date", type: "date" },
    { label: "Out Bound", name: "out_bound", type: "date" },
    { label: "Unloaded @ Dock", name: "unloaded_at_port", type: "date" },
    { label: "Empty At", name: "emptied_at", type: "select", options: emptyLocations }
  ];

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">

      {fields.map(({ label, name, type, options }) => (
        <div key={name} className={name === "material" ? "col-span-full md:col-span-3" : ""}>
          <label htmlFor={name} className="block mb-1 font-medium text-gray-700">{label}</label>
          {type === "select" ? (
            <TypableSelect
              options={options}
              value={formData[name]}
              onChange={(val) => setFormData(prev => ({ ...prev, [name]: val }))}
              placeholder={`Select ${label}`}
              disabled={options.length === 0}
            />
          ) : type === "textarea" ? (
            <textarea
              id={name}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              rows={3}
              className="w-full border rounded px-3 py-2 resize-none text-base"
            />
          ) : type === "checkbox" ? (

              <input
                id={name}
                type="checkbox"
                name={name}
                checked={!!formData[name]} // ensure boolean
                onChange={(e) =>
                  setFormData(prev => ({
                    ...prev,
                    [name]: e.target.checked ? 1 : 0 // store 1 or 0
                  }))
                }
                className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
          ) : (
            <input
              id={name}
              type={type}
              name={name}
              value={formData[name]}
              onChange={handleChange}
              onFocus={(e) => {
                if (type === "date" && e.target.showPicker) e.target.showPicker();
              }}
              className="w-full border rounded px-3 py-2 text-base"
            />
          )}
        </div>
      ))}

      {/* Note */}
      <div className="col-span-full">
        <label htmlFor="note" className="block mb-1 font-medium">Personal Note</label>
        <textarea
          id="note"
          name="note"
          value={formData.note}
          onChange={handleChange}
          className="w-full border rounded px-2 py-1.5"
          rows={2}
        />
      </div>

      {/* Documents */}
      <div className="col-span-full">
        <label className="block mb-2 font-semibold">Documents</label>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.map((doc, idx) => (
              <div key={idx} className="border rounded p-3 relative bg-gray-50 text-sm shadow-sm">
                <div className="flex justify-between items-center mb-2">
                  <a
                    href={
                      doc.isExisting
                        ? `http://${process.env.REACT_APP_NETWORK}:${process.env.REACT_APP_PORT}/getDocument/${doc.id}`
                        : URL.createObjectURL(doc.file)
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="truncate w-4/5 text-blue-600 hover:underline"
                    title="Click to view document"
                  >
                    {doc.isExisting
                      ? doc.file_path.split(/[\\/]/).pop()
                      : doc.file.name}
                  </a>

                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                    {doc.isExisting
                      ? doc.file_path?.split(".").pop()
                      : doc.file?.type?.split("/")[1] || "file"}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => removeDocumentInput(idx)}
                  className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-base"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>



        <input
          type="file"
          ref={fileInputRef}
          accept="application/pdf,image/*"
          onChange={handleAddNewFile}
          className="hidden"
        />

        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={triggerFilePicker}
            className="bg-green-600 text-white px-3 py-1.5 rounded hover:bg-green-700 text-sm"
          >
            + Add Document
          </button>
        </div>
      </div>

      {/* Submit */}
      <div className="col-span-full mt-3">
        <button
          type="submit"
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 text-sm"
        >
          Submit
        </button>
      </div>
    </form>
  );
}

export default ContainerEntryForm;
