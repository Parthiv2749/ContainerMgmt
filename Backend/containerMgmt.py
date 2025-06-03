from fastapi import FastAPI, Depends, HTTPException, status, Body, Form, UploadFile, File, Request, Query

from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.responses import FileResponse
import mimetypes
import shutil
from fastapi_utils.cbv import cbv
from fastapi_utils.inferring_router import InferringRouter

from fastapi.middleware.cors import CORSMiddleware
from datetime import datetime, timedelta, timezone

import jwt
from passlib.context import CryptContext # type: ignore
from typing import List, Optional, Dict, Any
import uvicorn

import os
from sqlalchemy import or_, cast, Float, func
from sqlalchemy.orm import Session
from datetime import date

# from Model.containermgmt.Cinfo.Supplier import Supplier 
from Schema import *
from Model import *
from save_upload_files import save_uploaded_files, remove_files
import json

from Model.db import Base, engine
# from ORMSchema.allModel import DataBaseAccess, get_db
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from fastapi.responses import StreamingResponse
from io import BytesIO
import os
import warnings
warnings.filterwarnings("ignore", category=DeprecationWarning)

# --- Configuration ---
SECRET_KEY = "mysecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15  # shorter expiry for access token
REFRESH_TOKEN_EXPIRE_MINUTES = 60 * 9  # e.g., refresh token valid for 1 day


fake_refresh_tokens: Dict[str, str] = {}

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_hashed_password(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=15))
    to_encode.update({"exp": expire})
    
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def generate_damage_report_pdf(data: dict) -> bytes:
    template_dir = os.path.join("templates", "report")
    env = Environment(loader=FileSystemLoader(template_dir))
    template = env.get_template("damage_report.html")

    html_content = template.render(data)
    pdf_bytes = HTML(string=html_content, base_url=".").write_pdf()

    return pdf_bytes

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
 )


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


ContainerRouter  = InferringRouter()
Cinfo = InferringRouter()

@app.on_event("startup")
def startup_event():
    print("⏳ Initializing database...")
    Base.metadata.create_all(bind=engine)
    print("✅ Database tables are ready.")

@app.get("/")
def root():
    return {"message": "Welcome"}

# --- Token Endpoint for Access and Refresh Tokens ---
@app.post("/token")
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):

    user = db.query(User).filter(User.username == form_data.username).first() 
    
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    # access_token = create_access_token({"sub": user["username"], "roles": user["roles"]}, access_token_expires)
    access_token = create_access_token({"sub": user.username, "roles": "admin"}, access_token_expires)
    
    refresh_token_expires = timedelta(minutes=REFRESH_TOKEN_EXPIRE_MINUTES)
    # refresh_token = create_refresh_token({"sub": user["username"]}, refresh_token_expires)
    refresh_token = create_refresh_token({"sub": user.username}, refresh_token_expires)
    
    # Store refresh token (in a real app, save in the database)

    # fake_refresh_tokens[user["username"]] = refresh_token
    fake_refresh_tokens[user.username] = refresh_token

    return {"access_token": access_token, "token_type": "bearer", "refresh_token": refresh_token}

# --- Refresh Token Endpoint ---
@app.post("/refresh")
async def refresh_token(refresh_token: str = Body(...), db: Session = Depends(get_db)):
    
    try:
        
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
       
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Validate that the refresh token matches the stored one
        stored_refresh = fake_refresh_tokens.get(username)
        if stored_refresh != refresh_token:
            raise HTTPException(status_code=401, detail="Refresh token mismatch")
        
        # Issue a new access token
        user = db.query(User).filter(User.username == username).first() 
        
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        new_access_token = create_access_token({"sub": user.username, "roles": "admin"}, access_token_expires)
        return {"access_token": new_access_token, "token_type": "bearer"}
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Utility: Get Current User with Roles ---
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if not username:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        
        user = db.query(User).filter(User.username == username).first()
       
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
        # Ensure the roles relationship is loaded
        db.refresh(user)  # This ensures the roles are correctly loaded
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

# --- RBAC Dependency: Check if User has at Least One Required Role ---
def require_roles(required_roles: List[str]):

    def role_checker(user: dict = Depends(get_current_user)):
        
        user_roles = user.get("roles", [])
        
        if not any(role in user_roles for role in required_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User does not have one of the required roles: {required_roles}"
            )
            
        return user
    
    return role_checker


@app.get("/users/me")
async def read_users_me(current_user: dict = Depends(get_current_user)):
    # Return the relevant user fields, including roles
    return {
        "username": current_user.username,
        "roles": [role.name for role in current_user.roles]  # Assuming 'name' is the field for role name
    }


@cbv(ContainerRouter)
class ContainerAPI:
    
    @ContainerRouter.get("/containerDetaiils")
    async def getcontainer(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data =( db.query(   ContainerDetails.Container_ID,
                            ContainerDetails.container_no,
                            Supplier.name.label("supplier"),
                            func.date_format(ContainerDetails.arrival_on_port.label("Date"), "%Y-%m-%d"),
                            UnloadVenue.venue.label("Venue"),
                            Status.name.label("Status")
                        )
                .outerjoin(Supplier, ContainerDetails.supplier == Supplier.supplier_id)
                .outerjoin(UnloadVenue, ContainerDetails.emptied_at == UnloadVenue.venue_id)
                .outerjoin(Status, ContainerDetails.status == Status.status_id)
                .order_by( func.date_format(ContainerDetails.arrival_on_port.label("Date"), "%Y-%m-%d"))
               ).all()
        
        column = ['container_id','Container No', 'Supplier', 'Arrival', 'Venue', 'Status']
        return json.dumps({"column": column, "data": [list(row) for row in data]})
                          
    @ContainerRouter.post("/setContainerDetails")
    async def set_container_details(self, 
        container_no: str = Form(...),
        supplier: Optional[str] = Form(None),
        material: Optional[str] = Form(None),
        arrival_on_port: Optional[str] = Form(None),
        docs: Optional[str] = Form(None),  # Assuming you're uploading a file for `docs`
        type: Optional[str] = Form(None),
        in_bound: Optional[str] = Form(None),
        emptied_at: Optional[str] = Form(None),
        empty_date: Optional[str] = Form(None),
        out_bound: Optional[str] = Form(None),
        unloaded_at_port: Optional[str] = Form(None),
        note: Optional[str] = Form(None),
        status: Optional[str] = Form(None),
        consignee: Optional[str] = Form(None),
        tax: Optional[str] = Form(None), #add field for tax
        PONo: Optional[str] = Form(None), 
        documents: Optional[List[UploadFile]] = File(None),
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user)):

        def clean_field(value, target_type):
            if value in ("", None):
                return None
            try:
                return target_type(value)
            except (ValueError, TypeError):
                return None

        containerEntry = ContainerDetails(
            container_no=container_no,
            supplier=clean_field(supplier, int),
            material=material or None,
            arrival_on_port=clean_field(arrival_on_port, date),
            docs=clean_field(docs, int),
            type=clean_field(type, int),
            in_bound=clean_field(in_bound, datetime),
            emptied_at=clean_field(emptied_at, int),
            empty_date=clean_field(empty_date, date),
            out_bound=clean_field(out_bound, datetime),
            unloaded_at_port=clean_field(unloaded_at_port, date),
            note=note or None,
            status=clean_field(status, int),
            consignee=clean_field(consignee, int),
            tax=clean_field(tax, int),
            PONo=PONo or None
        )


        db.add(containerEntry)
        db.commit()
        db.refresh(containerEntry)
        
        if documents:
                paths = save_uploaded_files(documents, "Shipping")
                for path in paths:
                    doc = ContainerDocs(container_id=containerEntry.Container_ID, path=path)
                    db.add(doc)

        db.commit()

        return {"message": "Container details added successfully"}
        # return containerEntry
    
    @ContainerRouter.get("/getContainerDetails/{container_id}", response_model=ContainerDetailsSchema)
    async def get_container_details_by_id(self,
        container_id: int, 
        db: Session = Depends(get_db), 
        current_user: dict = Depends(get_current_user)):
        
        container = db.query(ContainerDetails).filter(ContainerDetails.Container_ID == container_id).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")
        return container  # Will include related `documents`

    @ContainerRouter.delete("/deleteContainerDetails/{container_id}")
    async def delete_container(
        self,
        container_id: int,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user),
        ):
        # Step 1: Get report IDs associated with the container
        report_ids = db.query(ReportDetails.report_id).filter(
            ReportDetails.container_id == container_id
        ).all()
        report_ids = [r[0] for r in report_ids]  # Flatten tuples

        # Step 2: Get damage product IDs associated with these reports
        dmgp_ids = db.query(DamageProduct.id).filter(
            DamageProduct.report_id.in_(report_ids)
        ).all()
        dmgp_ids = [d[0] for d in dmgp_ids]

        # Step 3: Delete associated report images
        if dmgp_ids:
            db.query(ReportImage).filter(
                ReportImage.DMGP_id.in_(map(str, dmgp_ids))
            ).delete(synchronize_session=False)

        # Step 4: Delete damage product records
        if report_ids:
            db.query(DamageProduct).filter(
                DamageProduct.report_id.in_(report_ids)
            ).delete(synchronize_session=False)

        # Step 5: Delete all report records
        db.query(ReportDetails).filter(
            ReportDetails.container_id == container_id
        ).delete(synchronize_session=False)

        # Step 6: Delete container documents
        db.query(ContainerDocs).filter(
            ContainerDocs.container_id == container_id
        ).delete(synchronize_session=False)

        # Step 7: Delete the container itself
        container = db.query(ContainerDetails).filter(
            ContainerDetails.Container_ID == container_id
        ).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")

        db.delete(container)
        db.commit()

        return {"message": "Container deleted successfully"}

    @ContainerRouter.get("/getDocument/{doc_id}")
    async def get_document(self, doc_id: int, db: Session = Depends(get_db)):
        doc = db.query(ContainerDocs).filter(ContainerDocs.docs_id == doc_id).first()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = os.path.normpath(doc.path)
        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="File not found")

        # Guess MIME type based on file extension
        mime_type, _ = mimetypes.guess_type(file_path)
        mime_type = mime_type or "application/octet-stream"

        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=os.path.basename(file_path),
            headers={
                "Content-Disposition": f'inline; filename="{os.path.basename(file_path)}"'
            }
        )
    
    @ContainerRouter.post("/updateContainerDetails/{container_id}")
    async def update_container_details(self,
        container_id: int,
        request: Request,
        documents: List[UploadFile] = File([]),
        remove_doc_ids: List[int] = Form([]),
        db: Session = Depends(get_db)
        ):
        container = db.query(ContainerDetails).filter_by(Container_ID=container_id).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")

        form = await request.form()
        updated_fields = dict(form)

        skip_fields = {"remove_doc_ids"}
        for key in skip_fields:
            updated_fields.pop(key, None)

        if "tax" in updated_fields:
            updated_fields["tax"] = int(updated_fields["tax"])

        date_fields = {"arrival_date", "in_bound", "empty_date", "out_bound", "unloaded_at_dock", "emptied_at"}
        for field in date_fields:
            if field in updated_fields and updated_fields[field]:
                updated_fields[field] = str(updated_fields[field])  # Or parse dates properly if needed

        model_columns = ContainerDetails.__table__.columns.keys()
        cleaned_fields = {
            k: v for k, v in updated_fields.items()
            if k in model_columns and k not in {"documents", "remove_doc_ids"}
        }

        for key, value in cleaned_fields.items():
            if str(getattr(container, key)) != str(value):
                setattr(container, key, value)

        # Remove selected documents
        docs_to_remove = []
        for doc_id in remove_doc_ids:
            doc = db.query(ContainerDocs).filter_by(docs_id=doc_id, container_id=container_id).first()
            if doc:
                docs_to_remove.append(doc.path)
                db.delete(doc)

        # Use the helper to remove files
        remove_files(docs_to_remove)

        # Save new uploaded documents using your save_uploaded_files helper
        saved_paths = save_uploaded_files(documents, "Shipping")

        for path in saved_paths:
            db.add(ContainerDocs(container_id=container_id, path=path))

        db.commit()
        return {"message": "Container updated successfully"}
    
    @ContainerRouter.get("/getAllContainers")
    async def getContainerForREport(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = ( db.query(
            ContainerDetails.Container_ID,
            ContainerDetails.container_no,
            
            ) 
            .filter(ContainerDetails.status != 4 ) 
            ).all() 
           
        # column = ['Container ID','Container No', 'Supplier']
        return json.dumps({ "data": [list(row) for row in data]})
    
    @ContainerRouter.get("/getContainerReports")
    async def get_ContainerReports(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = ( db.query(
            ReportDetails.report_id,
            ContainerDetails.container_no
            ) 
            .outerjoin(ContainerDetails, ContainerDetails.Container_ID == ReportDetails.container_id) 
            ).all() 
           
        column = ['Report Id','Container No']
        return json.dumps({"column": column, "data": [list(row) for row in data]})
    
    @ContainerRouter.get("/submitDamagedProducts")
    async def submit_damage_report(
     data: str = Form(...),
     files: Optional[List[UploadFile]] = File(None),
     db: Session = Depends(get_db),
     current_user: dict = Depends(get_current_user)
     ):
        try:
          parsed_data: Dict[str, Any] = json.loads(data)
        except json.JSONDecodeError:
          raise HTTPException(status_code=400, detail="Invalid JSON format in data.")


        container_id = parsed_data.get("container_id")
        products = parsed_data.get("products", [])

        if not container_id:
            raise HTTPException(status_code=422, detail="Missing container_id.")

        # Create the report
        report = ReportDetails(
            container_id=container_id,
            report_date=datetime.utcnow().date()
        )
        db.add(report)
        db.commit()
        db.refresh(report)

        file_index = 0
        files = files or []  # Ensure files is a list

        for prod in products:
            name = prod.get("name")
            quantity = prod.get("quantity")
            reason = prod.get("reason")
            file_count = len(prod.get("files", []))

            if not name or not quantity:
                continue

            # Save product to DB
            damage_product = DamageProduct(
                report_id=report.report_id,
                product_name=name,
                qty=quantity,
                note=reason
            )
            db.add(damage_product)
            db.commit()
            db.refresh(damage_product)

            # Select files for this product
            product_files = files[file_index:file_index + file_count]
            file_index += file_count

            # Save files
            # upload_dir = f"uploads/reports/{report.report_id}/product_{damage_product.id}"
            saved_paths = save_uploaded_files(product_files, "Report")

            # Save image paths to ReportImage
            for path in saved_paths:
                report_image = ReportImage(
                    DMGP_id=str(damage_product.id),
                    path=path
                )
                db.add(report_image)

        db.commit()
        return {"message": "Report submitted", "report_id": report.report_id}

    @ContainerRouter.get("/getDamageReportById/{report_id}")
    async def get_damage_report(
        self,
        report_id: int,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user)
        ):
        report = db.query(ReportDetails).filter(ReportDetails.report_id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        container = db.query(ContainerDetails).filter(ContainerDetails.Container_ID == report.container_id).first()

        products = []
        for dp in db.query(DamageProduct).filter(DamageProduct.report_id == report.report_id).all():
            images = db.query(ReportImage).filter(ReportImage.DMGP_id == str(dp.id)).all()
            products.append({
                "id": dp.id,
                "name": dp.product_name,
                "quantity": dp.qty,
                "reason": dp.note,
                "files": [
                    {
                        "id": img.id,
                        "filename": img.path.split("/")[-1]  # assuming img.path stores full file path or URL
                    }
                    for img in images
                ]
            })

        return {
            "report_id": report_id,
            "containerId": container.Container_ID if container else None,
            "container_number": container.container_no if container else None,
            "products": products
        }
           
    @ContainerRouter.post("/updateDamagedProducts/{report_id}")
    async def update_damage_report(self,
        report_id: int,
        request: Request,
        files: Optional[List[UploadFile]] = File(None),
        remove_doc_ids: List[int] = Form([]),
        remove_product_ids: List[int] = Form([]),
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user)
     ):
        report = db.query(ReportDetails).filter_by(report_id=report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        form = await request.form()
        try:
            parsed_data: Dict[str, Any] = json.loads(form.get("data", "{}"))
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid JSON in 'data'")

        new_products = parsed_data.get("products", [])
        container_id = parsed_data.get("container_id")

        files = files or []
        file_index = 0
        paths_to_remove = []

        # print(new_products)
        # Remove specified images
        for doc_id in remove_doc_ids:
            doc = db.query(ReportImage).filter_by(id=doc_id).first()
            if doc:
                paths_to_remove.append(doc.path)
                db.delete(doc)

        # Remove specified products (and their images)
        for prod_id in remove_product_ids:
            product = db.query(DamageProduct).filter_by(id=prod_id, report_id=report_id).first()
            if product:
                images = db.query(ReportImage).filter_by(DMGP_id=product.id).all()
                for img in images:
                    paths_to_remove.append(img.path)
                    db.delete(img)
                db.delete(product)

        # Update report container if changed
        if container_id and report.container_id != container_id:
            report.container_id = container_id
            db.add(report)

        # Add or update products
        for product in new_products:
            
            prod_id = product.get("id")
            name = product.get("name")
            quantity = product.get("quantity")
            reason = product.get("reason")
            file_count = len(product.get("files", []))

            # if not name or not quantity:
                # continue  # Skip invalid entries
            
            # print(prod_id)
            if prod_id:  # Existing product — update
                existing_product = db.query(DamageProduct).filter_by(id=prod_id).first()
                if existing_product:
                    if name is not None:
                        existing_product.product_name = name
                    if quantity is not None:
                        existing_product.qty = quantity
                    if reason is not None:
                        existing_product.note = reason
                    db.add(existing_product)
                    db.commit()

                    # Save new files if any
                    new_files = files[file_index:file_index + file_count]
                    saved_paths = save_uploaded_files(new_files, "Report")
                    for path in saved_paths:
                        db.add(ReportImage(DMGP_id=existing_product.id, path=path))
                    file_index += file_count

            else:  # New product — insert
                new_product = DamageProduct(
                    report_id=report_id,
                    product_name=name,
                    qty=quantity,
                    note=reason
                )
                db.add(new_product)
                db.commit()
                db.refresh(new_product)

                new_files = files[file_index:file_index + file_count]
                saved_paths = save_uploaded_files(new_files, "Report")
                for path in saved_paths:
                    db.add(ReportImage(DMGP_id=new_product.id, path=path))
                file_index += file_count

        db.commit()
        remove_files(paths_to_remove)

        return {"message": "Report updated successfully", "report_id": report_id}
   
    @ContainerRouter.get("/getReportImage/{image_id}")
    async def get_report_image(self, image_id: int, db: Session = Depends(get_db)):
        image = db.query(ReportImage).filter(ReportImage.id == image_id).first()
        if not image:
            raise HTTPException(status_code=404, detail="Image not found")

        file_path = os.path.normpath(image.path)  # or image.path depending on your schema
        if not os.path.isfile(file_path):
            raise HTTPException(status_code=404, detail="File not found on disk")

        mime_type, _ = mimetypes.guess_type(file_path)
        mime_type = mime_type or "application/octet-stream"

        return FileResponse(
            path=file_path,
            media_type=mime_type,
            filename=os.path.basename(file_path),
            headers={
                "Content-Disposition": f'inline; filename="{os.path.basename(file_path)}"'
            }
        )

    @ContainerRouter.delete("/deleteDamagedReport/{report_id}")
    def delete_damage_report(self,
        report_id: int,
        db: Session = Depends(get_db),
        current_user: dict = Depends(get_current_user)
     ):
        report = db.query(ReportDetails).filter(ReportDetails.report_id == report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")

        # Collect image paths for removal from disk
        paths_to_remove: List[str] = []

        # Get all products for the report
        products = db.query(DamageProduct).filter(DamageProduct.report_id==report_id).all()
        for product in products:
            # Get all images for each product
            images = db.query(ReportImage).filter(ReportImage.DMGP_id==product.id).all()
            for img in images:
                paths_to_remove.append(img.path)
                db.delete(img)

            db.delete(product)

        # Delete images directly associated with report (if any)
        other_images = db.query(ReportImage).filter(ReportImage.DMGP_id==report_id).all()
        for img in other_images:
            paths_to_remove.append(img.path)
            db.delete(img)

        # Finally delete the report itself
        db.delete(report)
        db.commit()

        # Remove files from disk
        remove_files(paths_to_remove)

        return {"message": "Report and all related data deleted", "report_id": report_id}

    @ContainerRouter.get("/reports/{report_id}")
    def get_report_pdf(self, report_id: int, db: Session = Depends(get_db)):
        report = db.query(ReportDetails).filter(ReportDetails.report_id==report_id).first()
        if not report:
            raise HTTPException(status_code=404, detail="Report not found")
        
        container = db.query(ContainerDetails).filter(ContainerDetails.Container_ID == report.container_id).first()
        products = db.query(DamageProduct).filter(DamageProduct.report_id==report_id).all()
        data = {
            "container_number": container.container_no if container.container_no else "N/A",
            "report_date": report.report_date.strftime("%Y-%m-%d"),
            "products": [
                {
                    "product_name": p.product_name,
                    "qty": p.qty,
                    "note": p.note,
                    "images": [img.path for img in p.images]  # make sure paths are accessible
                }
                for p in products
            ]
        }

        pdf_bytes = generate_damage_report_pdf(data)
        return StreamingResponse(BytesIO(pdf_bytes), media_type="application/pdf", headers={
            "Content-Disposition": f"inline; filename=damage_report_{report_id}.pdf"
        })
    
    @ContainerRouter.get("/arrived")
    def get_arrived_containers(self, 
        date: date = Query(...),  # 👈 required query parameter
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user)
        ):
        containers = (
            db.query(ContainerDetails)
            .filter(ContainerDetails.arrival_on_port == date)
            # .filter(
            #     (ContainerDetails.owner_id == user.id) | (user.role.name == "admin")
            # )
            .all()
        )
        return containers

    @ContainerRouter.get("/toPickup")
    def get_toPickup_containers(self, 
        date: date = Query(...),  # 👈 required query parameter
        db: Session = Depends(get_db),
        user: User = Depends(get_current_user)
        ):
        containers = (
            db.query(ContainerDetails)
            .filter(ContainerDetails.empty_date == date)
            # .filter(
            #     (ContainerDetails.owner_id == user.id) | (user.role.name == "admin")
            # )
            .all()
        )
        return containers


@cbv(Cinfo)
class CinfoAPI:
    
    @Cinfo.get("/supplierDetails")
    async def getsupplier(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(Supplier.supplier_id, Supplier.name).all()
    
        return json.dumps({ "data": [list(row) for row in data]})
    
    @Cinfo.get("/containerType")
    async def gettype(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(ContainerType.type_id, ContainerType.type).all()
        
        return json.dumps({ "data": [list(row) for row in data]})
    
    @Cinfo.get("/unloadVenue")
    async def getvenue(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(UnloadVenue.venue_id, UnloadVenue.venue).all()
        
        return json.dumps({ "data": [list(row) for row in data]})
    
    @Cinfo.get("/consignee")
    async def getconsignee(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(Consignee.consignee_id, Consignee.consignee_name).all()
        
        return json.dumps({"data": [list(row) for row in data]})
    
    @Cinfo.get("/shippingDocument")
    async def getshippingDocument(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(ShippingDocument.doc_id, ShippingDocument.doc_type).all()
        # column = ['Document ID', 'Document Name']
        return json.dumps({ "data": [list(row) for row in data]})
    
    @Cinfo.get("/status")
    async def getStatus(self, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
        data = db.query(Status.status_id, Status.name).all()
        # column = ['Status ID', 'name']
        return json.dumps({ "data": [list(row) for row in data]})  

app.include_router(Cinfo)
app.include_router(ContainerRouter)


# Add this block to run with `python main.py`
if __name__ == "__main__":
    uvicorn.run("containerMgmt:app", host="172.16.32.180", port=8000, reload=True)
