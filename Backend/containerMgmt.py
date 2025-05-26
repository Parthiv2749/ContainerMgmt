from fastapi import FastAPI, Depends, HTTPException, status, Body, Form, UploadFile, File, Request
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
                            Supplier.name.label("supplier")
                        )
                .outerjoin(Supplier, ContainerDetails.supplier == Supplier.supplier_id)
               
               ).all()
        
        column = ['container_id','Container No', 'Supplier']
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
        current_user: dict = Depends(get_current_user)
    ):
        container = db.query(ContainerDetails).filter(ContainerDetails.Container_ID == container_id).first()
        if not container:
            raise HTTPException(status_code=404, detail="Container not found")
        return container  # Will include related `documents`

    
    @ContainerRouter.delete("/deleteContainerDetails/{container_id}")
    async def delete_container(self, container_id: int, db: Session = Depends(get_db), current_user: dict = Depends(get_current_user)):
       
        #delete reports and images associated with the container
        report_ids = db.query(ReportDetails.report_id).filter(ReportDetails.container_id == container_id).all()

        # Flatten list of tuples
        report_ids = [r[0] for r in report_ids]

        # Step 2: Delete all associated report images
        if report_ids:
            db.query(ReportImages).filter(ReportImages.report_id.in_(report_ids)).delete(synchronize_session=False)

        # Step 3: Delete all reports for the container
        db.query(ReportDetails).filter(ReportDetails.container_id == container_id).delete(synchronize_session=False)

                #delete documents associated with the container
        db.query(ContainerDocs).filter(ContainerDocs.container_id == container_id).delete()
        #delete container details
        
        container = db.query(ContainerDetails).filter(ContainerDetails.Container_ID == container_id).first()
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
    uvicorn.run("containerMgmt:app", host="localhost", port=8000, reload=True)
