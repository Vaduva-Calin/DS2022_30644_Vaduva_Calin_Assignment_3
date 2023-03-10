import { DeviceService } from './../services/device.service';
import { UserDialogComponent } from './../user-dialog/user-dialog.component';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminService } from './../services/admin.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { JwtHelperService } from '@auth0/angular-jwt';
import { User } from '../models/user';
import { animate, state, style, transition, trigger } from '@angular/animations';
import { DataSource } from '@angular/cdk/collections';
import { Observable, ReplaySubject } from 'rxjs';
import { Device } from '../models/device';
import { MatDialog } from '@angular/material/dialog';
import { DeviceDialogComponent } from '../device-dialog/device-dialog.component';
import { Message } from '../models/message';
import { SignalRService } from '../services/signal-r.service';

@Component({
  selector: 'app-admin-page',
  templateUrl: './admin-page.component.html',
  styleUrls: ['./admin-page.component.scss'],
  animations: [
    trigger('detailExpand', [
      state('collapsed', style({height: '0px', minHeight: '0'})),
      state('expanded', style({height: '*'})),
      transition('expanded <=> collapsed', animate('225ms cubic-bezier(0.4, 0.0, 0.2, 1)')),
    ]),
  ],
})

export class AdminPageComponent implements OnInit {
  users!: User[];
  devices!: Device[];
  displayedColumns: string[] = ['id','name', 'username', 'edit', 'delete'];
  usersToDisplay = this.users;
  usersSource = new ExampleDataSource(this.usersToDisplay);
  deviceColumns: string[] = ['id', 'description', 'address', 'maxConsumption', 'userId', 'edit', 'delete'];
  devicesToDisplay = this.devices;
  devicesSource = new ExampleDataSource(this.devicesToDisplay);
  userToAdd?: User;
  messageToDisplay: string[]=[];
  messageColumns: string[] = [ 'message'];
  messagesSource = new ExampleDataSource(this.messageToDisplay);
  messageToSend: string = '';
  message: Message = {};
  clientIsTyping: boolean = false;
  isChatActive: boolean = false;
  seen: boolean = false;

  constructor(private router: Router,
    private jwtHelper: JwtHelperService,
    private adminService: AdminService,
    private deviceService: DeviceService,
    public dialog: MatDialog,
    private signalRService: SignalRService
    ) {}

  ngOnInit(): void {
    this.isUserAuthenticated();
    this.initiateWebSocket();
    document.getElementById('typing')!.style.display='none';
  }

  initiateWebSocket(){
    this.signalRService.startConnection();
    this.signalRService.reciveMessageFromClient();
    this.signalRService.message$.subscribe((response) => {
      this.messageToDisplay.push(response);
      this.messagesSource.setData(this.messageToDisplay);
      this.clientIsTyping = false;
    })
    this.signalRService.reciveClientIsTyping();
    this.signalRService.isTyping$.subscribe((response) => {
      if(response == false){
        document.getElementById('typing')!.style.display='none';
      }else{
        document.getElementById('typing')!.style.display='block';
      }
      this.clientIsTyping = response;
    })

    this.signalRService.reciveSeenFormClient();
    this.signalRService.seen$.subscribe((response) => {
      this.seen = response;
      if(this.seen == true)
      document.getElementById('seen')!.style.display='block';
    })
  }

  isUserAuthenticated(){
    const token: string | null= localStorage.getItem("jwt");
    const role = localStorage.getItem('role');
    if(token && !this.jwtHelper.isTokenExpired(token) &&  role == 'admin'){
      this.getUsers();
      this.getDevices();
    }
    else{
      this.logOut();
    }
  }

  getUsers(){
    this.adminService.getUsers().subscribe({
      next:(result :any) => {this.users = result, this.usersSource.setData(result)},
      error: (err: HttpErrorResponse) => console.log(err)
    })
  }

  getDevices(){
    this.adminService.getDevices().subscribe({
      next:(result :any) => {this.users = result, this.devicesSource.setData(result)},
      error: (err: HttpErrorResponse) => console.log(err)
    })
  }

  logOut(){
    localStorage.removeItem('jwt');
    localStorage.removeItem('role');
    this.router.navigate(['']);
  }

  deleteUser(u: User){
    this.adminService.deleteUser(u.id!).subscribe(()=>{
      this.getUsers();
    });
  }

  editUser(u: User){
    console.log(u);
    let dialogRef = this.dialog.open(UserDialogComponent, {
      width: '400px',
      data: { username: u.userName, password: u.password, name: u.name},
      panelClass: 'dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      var userToEdit = result;
      if(userToEdit){
        console.log("Edit " + userToEdit);
        u.userName = userToEdit.userName;
        u.password = userToEdit.password;
        u.name = userToEdit.name;
        this.adminService.editUser(u).subscribe(()=>{
          this.getUsers();
          this.getDevices();
        });

      }
    });
  }

  openAddDialog(): void {
    let dialogRef = this.dialog.open(UserDialogComponent, {
      width: '400px',
      data: { username:'', password: "" },
      panelClass: 'dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      this.userToAdd = result;
      if(this.userToAdd){
        console.log(this.userToAdd);
        this.userToAdd.role='user';
        this.adminService.addUser(this.userToAdd).subscribe(()=>{
          this.getUsers();
        });

      }
    });
  }

  deleteDevice(device: Device){
    console.log(device);
    this.deviceService.deleteDevice(device.id!).subscribe(()=>{
      this.getDevices();
    });
  }

  editDevice(device: Device){
    let dialogRef = this.dialog.open(DeviceDialogComponent, {
      width: '550px',
      data: {description:device.description, address: device.address, maxConsumption: device.maxConsumption, userId: device.userId},
      panelClass: 'dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      let data: Device = result;
      if(data){
        console.log(data);
        device.description=data.description;
        device.address=data.address;
        device.maxConsumption=data.maxConsumption;
        device.userId=data.userId;
        this.deviceService.editDevice(device).subscribe(()=>{
          this.getDevices();
        });
      }
    });
  }

  openAddDeviceDialog(){
    let dialogRef = this.dialog.open(DeviceDialogComponent, {
      width: '550px',
      panelClass: 'dialog-container'
    });

    dialogRef.afterClosed().subscribe(result => {
      let deviceToAdd: Device = result;
      if(deviceToAdd){
        console.log(deviceToAdd);
        this.deviceService.addDevice(deviceToAdd).subscribe(()=>{
          this.getDevices();
        });
      }
    });
  }

  sendMessageToClient(){
    if(this.messageToSend !== null && this.messageToSend.trim()!==""){
      this.message.message=this.messageToSend;
      this.message.user="Calin: ";
      this.messageToDisplay.push(this.message.user + this.message.message);
      this.messagesSource.setData(this.messageToDisplay);
      this.signalRService.sendMessageToClient(this.message.user+this.message.message);
      this.messageToSend='';
      this.signalRService.sendAdminIsTyping(false);
    }
    document.getElementById('seen')!.style.display='none';
    if(this.seen == false){
      document.getElementById('seen')!.style.display='none';
    }else{
      document.getElementById('seen')!.style.display='block';
    }
  }

  sendIsTyping(){
    if(this.messageToSend != null && this.messageToSend != ''){
      this.signalRService.sendAdminIsTyping(true);
    }else{
      this.signalRService.sendAdminIsTyping(false);
    }
  }

  activateChat(){
    this.isChatActive = !this.isChatActive;
    this.signalRService.sendAdminSeenMessage(this.isChatActive);
    if(this.isChatActive == true){
      document.getElementById('chatBox')!.style.display="block";
    }else{
      document.getElementById('chatBox')!.style.display="none";
    }
  }

}

class ExampleDataSource extends DataSource<Object> {
  private _dataStream = new ReplaySubject<Object[]>();

  constructor(initialData: Object[]) {
    super();
    this.setData(initialData);
  }

  connect(): Observable<Object[]> {
    return this._dataStream;
  }

  disconnect() {}

  setData(data: Object[]) {
    this._dataStream.next(data);
  }
}


